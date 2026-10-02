import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MasterVerification, MasterVerificationStatus, Prisma, VerificationDocumentType } from '@prisma/client';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InvalidTransitionException } from '../../common/exceptions/business.exception';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { NotificationService } from '../notification/notification.service';
import { ReviewVerificationDto, SubmitVerificationDto, VerificationQueryDto } from './dto/verification.dto';
import { ERRORS } from '../../common/constants/error-messages';

const MAX_OPEN_DOCUMENTS = 10;
const SINGLE_DOCUMENT_TYPES: VerificationDocumentType[] = ['IDENTITY', 'LICENSE'];
const OPEN_STATUSES: MasterVerificationStatus[] = ['PENDING', 'UNDER_REVIEW'];
/** Shu holatdagi hujjat o‘rniga shu turdagi yangisini yuborish mumkin; yangisi yuborilgach eskisi INACTIVE bo‘ladi. */
const REPLACEABLE_STATUSES: MasterVerificationStatus[] = ['CORRECTION_REQUESTED', 'REJECTED', 'EXPIRED'];

const OWN_DOCUMENT_SELECT = {
  id: true,
  documentType: true,
  mediaAssetId: true,
  status: true,
  rejectionReason: true,
  reviewedAt: true,
  expiresAt: true,
  createdAt: true,
} satisfies Prisma.MasterVerificationSelect;

const REVIEW_TARGET: Record<'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION' | 'START_REVIEW', MasterVerificationStatus> = {
  APPROVE: 'VERIFIED',
  REJECT: 'REJECTED',
  REQUEST_CORRECTION: 'CORRECTION_REQUESTED',
  START_REVIEW: 'UNDER_REVIEW',
};

export function deriveVerification(
  documents: Array<Pick<MasterVerification, 'documentType' | 'status' | 'expiresAt' | 'createdAt'>>,
  now = new Date(),
): MasterVerificationStatus {
  // Almashtirilgan (nofaol) hujjatlar umumiy holatni belgilamaydi.
  documents = documents.filter((d) => d.status !== 'INACTIVE');
  const live = (d: { expiresAt: Date | null }) => !d.expiresAt || d.expiresAt > now;
  if (!documents.some((d) => d.documentType === 'IDENTITY')) return 'PENDING';
  if (documents.some((d) => d.documentType === 'IDENTITY' && d.status === 'VERIFIED' && live(d))) return 'VERIFIED';

  const latest = new Map<string, (typeof documents)[number]>();
  for (const doc of documents) {
    const current = latest.get(doc.documentType);
    if (!current || doc.createdAt > current.createdAt) latest.set(doc.documentType, doc);
  }
  const current = [...latest.values()];
  if (current.some((d) => OPEN_STATUSES.includes(d.status))) return 'UNDER_REVIEW';
  if (current.some((d) => d.status === 'CORRECTION_REQUESTED')) return 'CORRECTION_REQUESTED';
  if (current.some((d) => d.status === 'REJECTED')) return 'REJECTED';
  const identity = latest.get('IDENTITY');
  if (identity && (identity.status === 'EXPIRED' || (identity.status === 'VERIFIED' && !live(identity)))) return 'EXPIRED';
  return 'PENDING';
}

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationService,
    private readonly storage: StorageService,
  ) {}

  async create(userId: string, dto: SubmitVerificationDto) {
    const master = await this.requireMaster(userId);
    if (dto.expiresAt && dto.expiresAt <= new Date()) throw new ConflictException(ERRORS.DOCUMENT_EXPIRED);

    const document = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM master_profiles WHERE id = ${master.id}::uuid FOR UPDATE`;

      const asset = await tx.mediaAsset.findUnique({ where: { id: dto.mediaAssetId } });
      if (
        !asset ||
        asset.kind !== 'MASTER_VERIFICATION_DOCUMENT' ||
        asset.uploaderId !== userId ||
        asset.linkedResourceType !== 'MasterProfile' ||
        asset.linkedResourceId !== master.id
      ) {
        throw new ForbiddenException(ERRORS.MEDIA_NOT_VERIFICATION);
      }
      if (asset.status !== 'READY') throw new ConflictException(ERRORS.MEDIA_NOT_READY(asset.status));

      if (SINGLE_DOCUMENT_TYPES.includes(dto.documentType)) {
        // Tekshiruvda turgan yoki tasdiqlangan hujjat bo‘lsa — almashtirish uchun avval o‘chirish kerak.
        // Rad etilgan / tuzatish so‘ralgan / muddati tugagan bo‘lsa — yangisini yuborish mumkin.
        const existing = await tx.masterVerification.count({
          where: { masterId: master.id, documentType: dto.documentType, status: { notIn: [...REPLACEABLE_STATUSES, 'INACTIVE'] } },
        });
        if (existing > 0) throw new ConflictException(ERRORS.DOCUMENT_TYPE_ALREADY_UPLOADED(dto.documentType));
      }

      const open = await tx.masterVerification.findMany({
        where: { masterId: master.id, status: { in: OPEN_STATUSES } },
        select: { documentType: true },
      });
      if (open.length >= MAX_OPEN_DOCUMENTS) throw new ConflictException(ERRORS.TOO_MANY_PENDING_DOCUMENTS);
      if (open.some((d) => d.documentType === dto.documentType)) {
        throw new ConflictException(ERRORS.DOCUMENT_ALREADY_PENDING);
      }

      let created: MasterVerification;
      try {
        created = await tx.masterVerification.create({
          data: {
            masterId: master.id,
            documentType: dto.documentType,
            mediaAssetId: asset.id,
            expiresAt: dto.expiresAt,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(ERRORS.MEDIA_USED_VERIFICATION);
        }
        throw error;
      }
      // Shu turdagi eski (almashtiriladigan) hujjatlar nofaol holatga o‘tadi.
      const superseded = await tx.masterVerification.updateMany({
        where: { masterId: master.id, documentType: dto.documentType, id: { not: created.id }, status: { in: REPLACEABLE_STATUSES } },
        data: { status: 'INACTIVE' },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'VERIFICATION_SUBMITTED',
          targetType: 'MasterVerification',
          targetId: created.id,
          after: { documentType: dto.documentType, supersededDocuments: superseded.count },
        },
      });
      await this.recompute(tx, master.id);
      return created;
    });
    return this.db.masterVerification.findUniqueOrThrow({ where: { id: document.id }, select: OWN_DOCUMENT_SELECT });
  }

  async remove(userId: string, documentId: string) {
    const master = await this.requireMaster(userId);
    const document = await this.db.masterVerification.findFirst({
      where: { id: documentId, masterId: master.id },
      include: { mediaAsset: true },
    });
    if (!document) throw new NotFoundException(ERRORS.VERIFICATION_DOCUMENT_NOT_FOUND);

    const verification = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM master_profiles WHERE id = ${master.id}::uuid FOR UPDATE`;
      await tx.masterVerification.delete({ where: { id: document.id } });
      if (document.mediaAssetId) await tx.mediaAsset.delete({ where: { id: document.mediaAssetId } });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'VERIFICATION_DELETED',
          targetType: 'MasterVerification',
          targetId: document.id,
          before: { documentType: document.documentType, status: document.status },
        },
      });
      return this.recompute(tx, master.id);
    });

    const asset = document.mediaAsset;
    const keys = [asset?.originalKey, asset?.thumbnailKey, asset?.mediumKey, asset?.quarantineKey].filter(
      (key): key is string => !!key,
    );
    await Promise.all(
      keys.map((key) =>
        this.storage
          .deleteObject(key)
          .catch((error: unknown) => this.logger.warn(`${key} faylini o‘chirib bo‘lmadi: ${String(error)}`)),
      ),
    );
    return { deleted: true, verification };
  }

  async findAll(userId: string) {
    const master = await this.requireMaster(userId);
    return this.db.masterVerification.findMany({
      where: { masterId: master.id },
      select: OWN_DOCUMENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStatus(userId: string) {
    const master = await this.requireMaster(userId);
    await this.expireLapsed(master.id);
    const [fresh, documents] = await Promise.all([
      this.db.masterProfile.findUniqueOrThrow({ where: { id: master.id }, select: { verification: true, status: true } }),
      this.findAll(userId),
    ]);
    return { verification: fresh.verification, status: fresh.status, documents };
  }

  async findAllForAdmin(query: VerificationQueryDto) {
    const history = query.history === 'true';
    const rows = await this.db.masterVerification.findMany({
      where: { status: query.status ?? (history ? { notIn: OPEN_STATUSES } : { in: OPEN_STATUSES }), masterId: query.masterId },
      include: {
        master: { select: { id: true, profession: true, verification: true, user: { select: { accountNumber: true, firstName: true, lastName: true } } } },
        reviewedBy: { select: { accountNumber: true, firstName: true, lastName: true } },
      },
      orderBy: history ? [{ updatedAt: 'desc' }, { id: 'desc' }] : [{ createdAt: 'asc' }, { id: 'asc' }],
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    // Har bir hujjat bo‘yicha administrator amallari (kim, qachon, nima qildi) saqlanib turadi.
    const logs = await this.db.auditLog.findMany({
      where: { targetType: 'MasterVerification', targetId: { in: page.items.map((item) => item.id) }, action: { startsWith: 'VERIFICATION_' } },
      orderBy: { createdAt: 'asc' },
      select: { targetId: true, action: true, reason: true, createdAt: true, actor: { select: { accountNumber: true, firstName: true, lastName: true } } },
    });
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        actions: logs.filter((log) => log.targetId === item.id).map(({ targetId: _targetId, ...log }) => log),
      })),
    };
  }

  async findOneForAdmin(id: string) {
    const document = await this.db.masterVerification.findUnique({
      where: { id },
      include: {
        master: { select: { id: true, userId: true, profession: true, verification: true, status: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!document) throw new NotFoundException(ERRORS.VERIFICATION_DOCUMENT_NOT_FOUND);
    return document;
  }

  async review(adminId: string, id: string, dto: ReviewVerificationDto) {
    const target = REVIEW_TARGET[dto.decision];
    const document = await this.findOneForAdmin(id);

    const result = await this.db.$transaction(async (tx) => {
      const allowedFrom: MasterVerificationStatus[] = dto.decision === 'START_REVIEW' ? ['PENDING'] : OPEN_STATUSES;
      const changed = await tx.masterVerification.updateMany({
        where: { id, status: { in: allowedFrom } },
        data: {
          status: target,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason: dto.decision === 'REJECT' || dto.decision === 'REQUEST_CORRECTION' ? dto.reason : null,
        },
      });
      if (changed.count === 0) throw new InvalidTransitionException(document.status, target);

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `VERIFICATION_${dto.decision}`,
          targetType: 'MasterVerification',
          targetId: id,
          before: { status: document.status },
          after: { status: target },
          reason: dto.reason,
        },
      });
      const overall = await this.recompute(tx, document.masterId);
      return { overall };
    });

    await this.notifyMaster(document.master.userId, dto, result.overall);
    const updated = await this.findOneForAdmin(id);
    return { ...updated, masterVerification: result.overall };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireLapsedDocuments(): Promise<void> {
    try {
      const count = await this.expireLapsed();
      if (count > 0) this.logger.log(`${count} ta tasdiqlash hujjatining muddati tugadi`);
    } catch (error) {
      this.logger.error('Tasdiqlash hujjatlari muddatini yangilab bo‘lmadi', error instanceof Error ? error.stack : undefined);
    }
  }

  async expireLapsed(masterId?: string): Promise<number> {
    const lapsed = await this.db.masterVerification.findMany({
      where: { status: 'VERIFIED', expiresAt: { lte: new Date() }, masterId },
      select: { id: true, masterId: true },
    });
    if (lapsed.length === 0) return 0;
    const masterIds = [...new Set(lapsed.map((d) => d.masterId))];
    await this.db.$transaction(async (tx) => {
      await tx.masterVerification.updateMany({
        where: { id: { in: lapsed.map((d) => d.id) }, status: 'VERIFIED' },
        data: { status: 'EXPIRED' },
      });
      for (const id of masterIds) await this.recompute(tx, id);
    });
    return lapsed.length;
  }

  private async recompute(tx: Prisma.TransactionClient, masterId: string): Promise<MasterVerificationStatus> {
    const documents = await tx.masterVerification.findMany({
      where: { masterId },
      select: { documentType: true, status: true, expiresAt: true, createdAt: true },
    });
    const verification = deriveVerification(documents);
    await tx.masterProfile.update({ where: { id: masterId }, data: { verification } });
    if (verification !== 'VERIFIED') {
      await tx.masterProfile.updateMany({ where: { id: masterId, status: 'ACTIVE' }, data: { status: 'INACTIVE' } });
    }
    return verification;
  }

  private async notifyMaster(userId: string, dto: ReviewVerificationDto, overall: MasterVerificationStatus) {
    if (dto.decision === 'START_REVIEW') return;
    const messages: Record<string, { title: string; body: string }> = {
      APPROVE: { title: 'Hujjat tasdiqlandi', body: 'Verifikatsiya hujjatingiz tasdiqlandi.' },
      REJECT: { title: 'Hujjat rad etildi', body: `Hujjatingiz rad etildi: ${dto.reason}` },
      REQUEST_CORRECTION: { title: 'Hujjatni tuzating', body: `Hujjatni tuzatish so'raldi: ${dto.reason}` },
    };
    const message = messages[dto.decision];
    if (!message) return;
    try {
      await this.notifications.create({
        userId,
        channel: 'IN_APP',
        title: message.title,
        body: message.body,
        template: 'trust.review',
        data: { decision: dto.decision, verification: overall },
      });
    } catch (error) {
      this.logger.warn(`${userId} ustaga bildirishnoma yuborib bo‘lmadi: ${String(error)}`);
    }
  }

  private async requireMaster(userId: string) {
    const master = await this.db.masterProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!master) throw new NotFoundException(ERRORS.MASTER_PROFILE_NOT_FOUND);
    return master;
  }
}
