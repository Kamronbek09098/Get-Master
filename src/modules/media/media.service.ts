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

    const maxSize = this.config.get<number>('storage.maxUploadSizeBytes')!;
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

  async getSignedUrl(
    userId: string,
    roles: Role[],
    assetId: string,
    variant: 'original' | 'thumbnail' | 'medium',
  ): Promise<{ url: string; expiresIn: number }> {
    const asset = await this.db.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== 'READY') throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);

    await this.authorizeAccess(userId, roles, asset);

    const key = variant === 'thumbnail' ? asset.thumbnailKey : variant === 'medium' ? asset.mediumKey : asset.originalKey;
    if (!key) throw new NotFoundException(ERRORS.MEDIA_VARIANT_UNAVAILABLE);

    const ttl = this.config.get<number>('storage.signedUrlTtlSeconds')!;
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

  private async authorizeAccess(userId: string, roles: Role[], asset: MediaAsset): Promise<void> {
    if (roles.includes(Role.ADMIN)) return;
    if (asset.uploaderId === userId) return;

    if (asset.kind === 'MASTER_PORTFOLIO') {
      const item = await this.db.masterPortfolio.findUnique({ where: { mediaAssetId: asset.id } });
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
