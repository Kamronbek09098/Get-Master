import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaAsset, MediaAssetKind, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { ALLOWED_MIME_TYPES, EXTENSIONS_BY_MIME } from '../../infrastructure/media/media-allowlist';
import { LinkTarget } from './dto/link-target';
import { ERRORS } from '../../common/constants/error-messages';

const MAX_FILENAME_LENGTH = 255;
const MAX_MIME_TYPE_LENGTH = 150;

interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Ish lentasi videosi: ko‘pi bilan 40 MB (taxminan 60 soniyalik 720p). */
export const FEED_VIDEO_MAX_BYTES = 40 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
  ) {}

  async initiateUpload(
    uploaderId: string,
    file: UploadFile,
    kind: MediaAssetKind,
    link: LinkTarget,
  ): Promise<MediaAsset> {
    await this.authorizeUpload(uploaderId, kind, link);

    if (file.originalname.length > MAX_FILENAME_LENGTH || file.mimetype.length > MAX_MIME_TYPE_LENGTH) {
      throw new BadRequestException(ERRORS.FILE_NAME_TOO_LONG);
    }

    // Lenta/portfolio uchun qisqa video: umumiy chegaradan kattaroq (rasm va boshqa fayllar uchun chegara o‘zgarmaydi).
    const baseMax = this.config.get<number>('storage.maxUploadSizeBytes')!;
    const isShortVideo = kind === 'MASTER_PORTFOLIO' && file.mimetype.startsWith('video/');
    const maxSize = isShortVideo ? Math.max(baseMax, FEED_VIDEO_MAX_BYTES) : baseMax;
    if (file.size > maxSize || file.buffer.length > maxSize) {
      return this.reject(uploaderId, kind, file, link, 'File exceeds the maximum allowed size');
    }

    const sniffed = await fileTypeFromBuffer(file.buffer);
    // file-type audio-only .webm (MediaRecorder/Opus) ni ham video/webm deb aniqlaydi; ovozli xabar audio/webm deb kelsa shunday qabul qilinadi.
    const detected =
      sniffed && sniffed.mime === 'video/webm' && file.mimetype === 'audio/webm' ? { ...sniffed, mime: 'audio/webm' as const } : sniffed;
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      return this.reject(uploaderId, kind, file, link, 'Unsupported or undetectable file content');
    }

    const ext = extname(file.originalname).toLowerCase();
    const allowedExts = EXTENSIONS_BY_MIME[detected.mime] ?? [];
    if (!allowedExts.includes(ext)) {
      return this.reject(uploaderId, kind, file, link, 'File extension does not match its actual content');
    }

    if (file.mimetype !== detected.mime) {
      return this.reject(uploaderId, kind, file, link, 'Declared content type does not match detected content type');
    }

    const id = randomUUID();
    const quarantineKey = `quarantine/${id}`;
    await this.storage.putObject(quarantineKey, file.buffer, detected.mime);

    return this.persistQuarantined(uploaderId, id, quarantineKey, kind, file, detected.mime, link).catch(
      async (error: unknown) => {
        await this.storage.deleteObject(quarantineKey).catch(() => undefined);
        throw error;
      },
    );
  }

  private persistQuarantined(
    uploaderId: string,
    id: string,
    quarantineKey: string,
    kind: MediaAssetKind,
    file: UploadFile,
    detectedMime: string,
    link: LinkTarget,
  ): Promise<MediaAsset> {
    return this.db.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          id,
          uploaderId,
          kind,
          status: 'QUARANTINED',
          quarantineKey,
          originalName: file.originalname,
          declaredMimeType: file.mimetype,
          detectedMimeType: detectedMime,
          sizeBytes: BigInt(file.size),
          linkedResourceType: link.type,
          linkedResourceId: link.id,
        },
      });

      await this.outbox.emit(tx, {
        eventName: 'media.quarantined',
        aggregateType: 'MediaAsset',
        aggregateId: asset.id,
        payload: { mediaAssetId: asset.id },
        createdById: uploaderId,
      });

      return asset;
    });
  }

  private streamSignature(assetId: string, variant: string, expires: number): string {
    const secret = this.config.getOrThrow<string>('auth.jwtSecret');
    return createHmac('sha256', secret).update(`${assetId}:${variant}:${expires}`).digest('hex');
  }

  /** Imzolangan API havolasini tekshiradi va faylning saqlash kalitini qaytaradi. */
  async resolveStream(assetId: string, variant: 'original' | 'thumbnail' | 'medium', expires: number, signature: string) {
    const expected = Buffer.from(this.streamSignature(assetId, variant, expires));
    const given = Buffer.from(signature ?? '');
    if (!Number.isFinite(expires) || expires < Date.now() / 1000 || expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);
    }
    const asset = await this.db.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== 'READY') throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);
    const key = variant === 'thumbnail' ? asset.thumbnailKey : variant === 'medium' ? asset.mediumKey : asset.originalKey;
    if (!key) throw new NotFoundException(ERRORS.MEDIA_VARIANT_UNAVAILABLE);
    const contentType = variant === 'original' ? (asset.detectedMimeType ?? 'application/octet-stream') : 'image/jpeg';
    return { key, contentType, filename: asset.originalName };
  }

  async getSignedUrl(
    userId: string,
    roles: Role[],
    assetId: string,
    variant: 'original' | 'thumbnail' | 'medium',
    apiBase?: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const asset = await this.db.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== 'READY') throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);

    await this.authorizeAccess(userId, roles, asset);

    const key = variant === 'thumbnail' ? asset.thumbnailKey : variant === 'medium' ? asset.mediumKey : asset.originalKey;
    if (!key) throw new NotFoundException(ERRORS.MEDIA_VARIANT_UNAVAILABLE);

    const ttl = this.config.get<number>('storage.signedUrlTtlSeconds')!;
    if (apiBase) {
      // Fayl API orqali beriladi: telefon/tunnel orqali ulangan qurilma saqlash serveriga (localhost) to‘g‘ridan-to‘g‘ri ulana olmaydi.
      const expires = Math.floor(Date.now() / 1000) + ttl;
      const signature = this.streamSignature(assetId, variant, expires);
      return { url: `${apiBase}/api/v1/media/file/${assetId}/${variant}?expires=${expires}&sig=${signature}`, expiresIn: ttl };
    }
    const url = await this.storage.getSignedGetUrl(key, ttl, { downloadFilename: asset.originalName });
    return { url, expiresIn: ttl };
  }

  async getStatus(userId: string, roles: Role[], assetId: string): Promise<MediaAsset> {
    const asset = await this.db.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);
    await this.authorizeAccess(userId, roles, asset);
    return asset;
  }

  private async reject(
    uploaderId: string,
    kind: MediaAssetKind,
    file: UploadFile,
    link: LinkTarget,
    reason: string,
  ): Promise<MediaAsset> {
    return this.db.mediaAsset.create({
      data: {
        uploaderId,
        kind,
        status: 'REJECTED',
        rejectionReason: reason,
        originalName: file.originalname,
        declaredMimeType: file.mimetype,
        sizeBytes: BigInt(file.size ?? file.buffer.length),
        linkedResourceType: link.type,
        linkedResourceId: link.id,
      },
    });
  }

  private async authorizeUpload(uploaderId: string, kind: MediaAssetKind, link: LinkTarget): Promise<void> {
    switch (kind) {
      case 'PROBLEM_ATTACHMENT': {
        if (link.type !== 'ProblemRequest') throw new ForbiddenException(ERRORS.MEDIA_INVALID_TARGET);
        const request = await this.db.problemRequest.findUnique({ where: { id: link.id } });
        if (!request || request.customerId !== uploaderId) {
          throw new ForbiddenException(ERRORS.NOT_AUTHORIZED_REQUEST_MEDIA);
        }
        if (!['DRAFT', 'SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'].includes(request.status)) {
          throw new ForbiddenException(ERRORS.REQUEST_NO_ATTACHMENTS);
        }
        return;
      }
      case 'WORK_PROOF': {
        if (link.type !== 'Order') throw new ForbiddenException(ERRORS.MEDIA_INVALID_TARGET);
        const order = await this.db.order.findUnique({ where: { id: link.id } });
        if (!order) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
        const masterProfile = await this.db.masterProfile.findUnique({ where: { userId: uploaderId } });
        if (!masterProfile || order.masterId !== masterProfile.id) {
          throw new ForbiddenException(ERRORS.NOT_AUTHORIZED_WORK_PROOF);
        }
        if (!['ARRIVED', 'IN_PROGRESS'].includes(order.status)) {
          throw new ForbiddenException(ERRORS.WORK_PROOF_WRONG_STATE);
        }
        return;
      }
      case 'MESSAGE_ATTACHMENT': {
        if (link.type !== 'Conversation') throw new ForbiddenException(ERRORS.MEDIA_INVALID_TARGET);
        const participant = await this.db.conversationParticipant.findUnique({
          where: { conversationId_userId: { conversationId: link.id, userId: uploaderId } },
        });
        if (!participant) throw new ForbiddenException(ERRORS.NOT_CONVERSATION_PARTICIPANT);
        return;
      }
      case 'SUBSCRIPTION_RECEIPT': {
        if (link.type !== 'Subscription') throw new ForbiddenException(ERRORS.MEDIA_INVALID_TARGET);
        const subscription = await this.db.subscription.findUnique({ where: { id: link.id } });
        if (!subscription || subscription.userId !== uploaderId) throw new ForbiddenException(ERRORS.MEDIA_ACCESS_DENIED);
        if (subscription.status !== 'PENDING' || subscription.method !== 'CARD') throw new ForbiddenException(ERRORS.SUBSCRIPTION_NOT_PENDING);
        return;
      }
      case 'USER_AVATAR': {
        // Faqat profil egasining o‘zi nomidan (admin yuklasa ham, fayl egasi — shu foydalanuvchi) va faqat AvatarService orqali.
        if (link.type !== 'User' || link.id !== uploaderId) throw new ForbiddenException(ERRORS.MEDIA_INVALID_TARGET);
        return;
      }
      case 'MASTER_PORTFOLIO':
      case 'MASTER_VERIFICATION_DOCUMENT': {
        const masterProfile = await this.db.masterProfile.findUnique({ where: { userId: uploaderId } });
        if (!masterProfile || link.type !== 'MasterProfile' || link.id !== masterProfile.id) {
          throw new ForbiddenException(ERRORS.NOT_MASTER_PROFILE_OWNER);
        }
        return;
      }
    }
  }

  /**
   * Lenta uchun: tayyor fayllar uchun imzolangan API havolalarini bir marta hisoblaydi (har bir fayl uchun alohida so‘rov kerak bo‘lmasin).
   * Kirish huquqi chaqiruvchi tomonidan tekshirilgan (faqat e'lon qilingan postlar fayllari uchun chaqiriladi).
   */
  async signMany(assetIds: string[], apiBase: string): Promise<Map<string, { thumbnail: string | null; medium: string | null; original: string | null }>> {
    const ids = [...new Set(assetIds.filter(Boolean))];
    const out = new Map<string, { thumbnail: string | null; medium: string | null; original: string | null }>();
    if (ids.length === 0) return out;
    const assets = await this.db.mediaAsset.findMany({ where: { id: { in: ids }, status: 'READY' }, select: { id: true, thumbnailKey: true, mediumKey: true, originalKey: true } });
    const ttl = this.config.get<number>('storage.signedUrlTtlSeconds')!;
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const url = (id: string, variant: 'original' | 'thumbnail' | 'medium') =>
      `${apiBase}/api/v1/media/file/${id}/${variant}?expires=${expires}&sig=${this.streamSignature(id, variant, expires)}`;
    for (const asset of assets) {
      out.set(asset.id, {
        thumbnail: asset.thumbnailKey ? url(asset.id, 'thumbnail') : null,
        medium: asset.mediumKey ? url(asset.id, 'medium') : null,
        original: asset.originalKey ? url(asset.id, 'original') : null,
      });
    }
    return out;
  }

  private async authorizeAccess(userId: string, roles: Role[], asset: MediaAsset): Promise<void> {
    if (roles.includes(Role.ADMIN)) return;
    if (asset.uploaderId === userId) return;

    if (asset.kind === 'MASTER_PORTFOLIO') {
      // Ish lentasida e'lon qilingan (ochiq) post fayllarini har bir kirgan foydalanuvchi ko‘ra oladi.
      const post = await this.db.workPost.findFirst({
        where: { status: 'PUBLISHED', OR: [{ videoAssetId: asset.id }, { coverAssetId: asset.id }, { beforeAssetId: asset.id }, { afterAssetId: asset.id }] },
        select: { id: true },
      });
      if (post) return;
      const item = await this.db.masterPortfolio.findFirst({
        where: { OR: [{ mediaAssetId: asset.id }, { beforeMediaAssetId: asset.id }] },
        select: { status: true },
      });
      if (item?.status === 'APPROVED') return;
    }

    if (asset.linkedResourceType === 'ProblemRequest' && asset.linkedResourceId) {
      const request = await this.db.problemRequest.findUnique({ where: { id: asset.linkedResourceId } });
      if (request?.customerId === userId) return;
      const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
      if (masterProfile) {
        const offer = await this.db.offer.findFirst({
          where: { requestId: asset.linkedResourceId, masterId: masterProfile.id },
        });
        if (offer) return;
        // Faol, tasdiqlangan usta ochiq so‘rovdagi rasmlarni ko‘ra oladi (so‘rov matni kabi, taklif berish uchun).
        if (masterProfile.status === 'ACTIVE' && masterProfile.verification === 'VERIFIED' && request && request.customerId !== userId) {
          const open = ['SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'].includes(request.status) && (!request.expiresAt || request.expiresAt > new Date());
          if (open) return;
        }
      }
    } else if (asset.linkedResourceType === 'Order' && asset.linkedResourceId) {
      const order = await this.db.order.findUnique({ where: { id: asset.linkedResourceId } });
      if (order?.customerId === userId) return;
      const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
      if (masterProfile && order?.masterId === masterProfile.id) return;
    } else if (asset.linkedResourceType === 'Conversation' && asset.linkedResourceId) {
      const participant = await this.db.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: asset.linkedResourceId, userId } },
      });
      if (participant) return;
    }

    throw new ForbiddenException(ERRORS.MEDIA_ACCESS_DENIED);
  }
}
