import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { cursorArgs, dateRangeWhere, toCursorPage } from '../../common/utils/cursor';
import { AuditQueryDto } from './dto/audit-query.dto';

const PERSON = { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } as const;

@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}

  async findAll(query: AuditQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.AuditLogWhereInput = {
      actorId: query.actorId,
      targetType: query.targetType,
      targetId: query.targetId,
      createdAt: dateRangeWhere(query),
      AND: [
        ...(query.action ? [{ action: query.action }] : []),
        ...(query.category ? [{ action: { startsWith: query.category } }] : []),
        ...(search
          ? [{ OR: [{ action: { contains: search, mode: 'insensitive' as const } }, { reason: { contains: search, mode: 'insensitive' as const } }] }]
          : []),
      ],
    };
    const rows = await this.db.auditLog.findMany({
      where,
      include: { actor: { select: PERSON } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { ...page, items: await this.withTargetUsers(page.items) };
  }

  /** Amal kimga qarshi bajarilganini (foydalanuvchi yoki usta hujjati egasi) ko‘rsatish uchun. */
  private async withTargetUsers<T extends { targetType: string | null; targetId: string | null }>(items: T[]) {
    const userIds = new Set<string>();
    const verificationIds = new Set<string>();
    const profileIds = new Set<string>();
    for (const item of items) {
      if (!item.targetId) continue;
      if (item.targetType === 'User') userIds.add(item.targetId);
      else if (item.targetType === 'MasterVerification') verificationIds.add(item.targetId);
      else if (item.targetType === 'MasterProfile') profileIds.add(item.targetId);
    }
    const [verifications, profiles] = await Promise.all([
      this.db.masterVerification.findMany({
        where: { id: { in: [...verificationIds] } },
        select: { id: true, documentType: true, master: { select: { userId: true } } },
      }),
      this.db.masterProfile.findMany({ where: { id: { in: [...profileIds] } }, select: { id: true, userId: true } }),
    ]);
    const userOfVerification = new Map(verifications.map((v) => [v.id, v.master.userId]));
    const userOfProfile = new Map(profiles.map((p) => [p.id, p.userId]));
    for (const id of userOfVerification.values()) userIds.add(id);
    for (const id of userOfProfile.values()) userIds.add(id);
    const users = userIds.size ? await this.db.user.findMany({ where: { id: { in: [...userIds] } }, select: PERSON }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const documentType = new Map(verifications.map((v) => [v.id, v.documentType]));

    return items.map((item) => {
      const userId =
        item.targetType === 'User'
          ? item.targetId
          : item.targetType === 'MasterVerification'
            ? userOfVerification.get(item.targetId ?? '')
            : item.targetType === 'MasterProfile'
              ? userOfProfile.get(item.targetId ?? '')
              : undefined;
      return {
        ...item,
        targetUser: (userId && byId.get(userId)) || null,
        targetDocumentType: item.targetType === 'MasterVerification' ? (documentType.get(item.targetId ?? '') ?? null) : null,
      };
    });
  }
}
