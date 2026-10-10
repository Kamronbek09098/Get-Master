import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERRORS } from '../../common/constants/error-messages';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { MediaService } from '../media/media.service';
import { CreateCommentDto, CreateWorkPostDto, FeedQueryDto } from './dto/feed.dto';

const TREND_WINDOW_DAYS = 30;
const TREND_CANDIDATES = 300;

const POST_INCLUDE = {
  master: {
    select: {
      id: true,
      profession: true,
      ratingAvg: true,
      ratingCount: true,
      completedOrders: true,
      experienceYears: true,
      isPro: true,
      verification: true,
      user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, avatarAssetId: true } },
    },
  },
} satisfies Prisma.WorkPostInclude;

type PostRow = Prisma.WorkPostGetPayload<{ include: typeof POST_INCLUDE }>;

/** Faqat faol va tasdiqlangan ustalarning e'lon qilingan postlari ommaviy ko‘rinadi. */
const PUBLIC_WHERE: Prisma.WorkPostWhereInput = { status: 'PUBLISHED', master: { status: 'ACTIVE', verification: 'VERIFIED' } };

const trendScore = (post: { likeCount: number; saveCount: number; shareCount: number; commentCount: number; viewCount: number; createdAt: Date }) => {
  const ageDays = (Date.now() - post.createdAt.getTime()) / 86_400_000;
  const engagement = post.likeCount * 3 + post.saveCount * 4 + post.shareCount * 5 + post.commentCount * 2 + post.viewCount * 0.2;
  // Yangi ishlar biroz ustun: har kuni ~4% pasayadi.
  return engagement * Math.pow(0.96, ageDays);
};

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly media: MediaService,
    private readonly storage: StorageService,
  ) {}

  // ---------- O‘qish ----------

  async list(userId: string, query: FeedQueryDto, apiBase: string) {
    const limit = query.limit ?? 10;
    const tab = query.tab ?? 'foryou';
    const search = query.q?.trim();
    const filters: Prisma.WorkPostWhereInput[] = [PUBLIC_WHERE];
    if (query.category) filters.push({ categoryId: query.category });
    if (query.master) filters.push({ masterId: query.master });
    if (search) {
      filters.push({
        OR: [
          { caption: { contains: search, mode: 'insensitive' } },
          { tags: { has: search.toLowerCase().replace(/^#/, '') } },
          { master: { profession: { contains: search, mode: 'insensitive' } } },
          { master: { user: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } } },
        ],
      });
      const [service, category] = await Promise.all([
        this.db.service.findMany({ where: { name: { contains: search, mode: 'insensitive' } }, select: { id: true }, take: 20 }),
        this.db.serviceCategory.findMany({ where: { name: { contains: search, mode: 'insensitive' } }, select: { id: true }, take: 10 }),
      ]);
      const [orWhere] = filters.slice(-1) as [{ OR: Prisma.WorkPostWhereInput[] }];
      if (service.length) orWhere.OR.push({ serviceId: { in: service.map((item) => item.id) } });
      if (category.length) orWhere.OR.push({ categoryId: { in: category.map((item) => item.id) } });
    }
    if (tab === 'following') filters.push({ master: { followers: { some: { userId } } } });
    const where: Prisma.WorkPostWhereInput = { AND: filters };

    // Offset asosidagi ro‘yxatlar: trend (ball bo‘yicha) va saqlanganlar (saqlangan vaqt bo‘yicha).
    if (tab === 'trend' || tab === 'saved') {
      const offset = Number(query.cursor && /^\d+$/.test(query.cursor) ? query.cursor : 0);
      let ordered: PostRow[];
      if (tab === 'trend') {
        const since = new Date(Date.now() - TREND_WINDOW_DAYS * 86_400_000);
        const rows = await this.db.workPost.findMany({ where: { AND: [where, { createdAt: { gte: since } }] }, include: POST_INCLUDE, orderBy: { createdAt: 'desc' }, take: TREND_CANDIDATES });
        ordered = rows.sort((a, b) => trendScore(b) - trendScore(a));
      } else {
        const saves = await this.db.workPostSave.findMany({ where: { userId, post: where }, orderBy: { createdAt: 'desc' }, select: { post: { include: POST_INCLUDE } }, take: 200 });
        ordered = saves.map((row) => row.post);
      }
      const slice = ordered.slice(offset, offset + limit);
      return { items: await this.present(userId, slice, apiBase), nextCursor: offset + limit < ordered.length ? String(offset + limit) : null };
    }

    const cursor = query.cursor && !/^\d+$/.test(query.cursor) ? query.cursor : undefined;
    const rows = await this.db.workPost.findMany({
      where,
      include: POST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items: await this.present(userId, items, apiBase), nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }

  /** Ustaning o‘z postlari (ommaviy holatidan qat’i nazar). */
  async mine(userId: string, apiBase: string) {
    const profile = await this.requireMaster(userId);
    const rows = await this.db.workPost.findMany({ where: { masterId: profile.id }, include: POST_INCLUDE, orderBy: { createdAt: 'desc' }, take: 100 });
    return { items: await this.present(userId, rows, apiBase), nextCursor: null };
  }

  async findOne(userId: string, id: string, apiBase: string) {
    const row = await this.db.workPost.findFirst({ where: { id, OR: [PUBLIC_WHERE, { master: { userId } }] }, include: POST_INCLUDE });
    if (!row) throw new NotFoundException(ERRORS.FEED_POST_NOT_FOUND);
    return (await this.present(userId, [row], apiBase))[0];
  }

  // ---------- Yozish ----------

  async create(userId: string, dto: CreateWorkPostDto) {
    const profile = await this.requireMaster(userId);
    const need = dto.kind === 'VIDEO' ? [dto.videoAssetId] : dto.kind === 'BEFORE_AFTER' ? [dto.beforeAssetId, dto.afterAssetId] : [dto.afterAssetId];
    if (need.some((value) => !value)) throw new BadRequestException(ERRORS.FEED_POST_INVALID);
    const checks: Array<[string | undefined, 'video' | 'image']> = [
      [dto.videoAssetId, 'video'],
      [dto.coverAssetId, 'image'],
      [dto.beforeAssetId, 'image'],
      [dto.afterAssetId, 'image'],
    ];
    for (const [assetId, type] of checks) if (assetId) await this.requireAsset(userId, profile.id, assetId, type);

    let categoryId = dto.categoryId;
    if (dto.serviceId) {
      const service = await this.db.service.findUnique({ where: { id: dto.serviceId }, select: { categoryId: true } });
      if (!service) throw new BadRequestException(ERRORS.FEED_POST_INVALID);
      categoryId = categoryId ?? service.categoryId;
    }
    const created = await this.db.workPost.create({
      data: {
        masterId: profile.id,
        kind: dto.kind,
        caption: dto.caption?.trim() || null,
        tags: [...new Set(dto.tags ?? [])].slice(0, 8),
        categoryId,
        serviceId: dto.serviceId,
        videoAssetId: dto.kind === 'VIDEO' ? dto.videoAssetId : null,
        coverAssetId: dto.coverAssetId,
        beforeAssetId: dto.kind === 'BEFORE_AFTER' ? dto.beforeAssetId : null,
        afterAssetId: dto.kind === 'VIDEO' ? null : dto.afterAssetId,
        durationSec: dto.durationSec,
      },
      select: { id: true },
    });
    await this.db.auditLog.create({ data: { actorId: userId, action: 'WORK_POST_CREATED', targetType: 'WorkPost', targetId: created.id } });
    return created;
  }

  async remove(userId: string, id: string) {
    const post = await this.db.workPost.findFirst({ where: { id, master: { userId } } });
    if (!post) throw new NotFoundException(ERRORS.FEED_POST_NOT_FOUND);
    const assetIds = [post.videoAssetId, post.coverAssetId, post.beforeAssetId, post.afterAssetId].filter((value): value is string => !!value);
    const assets = await this.db.mediaAsset.findMany({ where: { id: { in: assetIds } } });
    await this.db.$transaction([
      this.db.workPost.delete({ where: { id } }),
      this.db.mediaAsset.deleteMany({ where: { id: { in: assetIds } } }),
      this.db.auditLog.create({ data: { actorId: userId, action: 'WORK_POST_REMOVED', targetType: 'WorkPost', targetId: id } }),
    ]);
    const keys = assets.flatMap((asset) => [asset.originalKey, asset.thumbnailKey, asset.mediumKey, asset.quarantineKey]).filter((key): key is string => !!key);
    await Promise.all(keys.map((key) => this.storage.deleteObject(key).catch((error: unknown) => this.logger.warn(`${key} faylini o‘chirib bo‘lmadi: ${String(error)}`))));
    return { deleted: true };
  }

  async view(userId: string, id: string) {
    await this.requirePublic(id);
    await this.db.workPost.updateMany({ where: { id, status: 'PUBLISHED', master: { userId: { not: userId } } }, data: { viewCount: { increment: 1 } } });
    return { ok: true };
  }

  async share(id: string) {
    await this.requirePublic(id);
    await this.db.workPost.updateMany({ where: { id, status: 'PUBLISHED' }, data: { shareCount: { increment: 1 } } });
    return { ok: true };
  }

  async setLike(userId: string, id: string, on: boolean) {
    await this.requirePublic(id);
    const exists = await this.db.workPostLike.findUnique({ where: { postId_userId: { postId: id, userId } } });
    if (on && !exists) {
      await this.db.$transaction([this.db.workPostLike.create({ data: { postId: id, userId } }), this.db.workPost.update({ where: { id }, data: { likeCount: { increment: 1 } } })]);
    } else if (!on && exists) {
      await this.db.$transaction([this.db.workPostLike.delete({ where: { postId_userId: { postId: id, userId } } }), this.db.workPost.update({ where: { id }, data: { likeCount: { decrement: 1 } } })]);
    }
    const post = await this.db.workPost.findUnique({ where: { id }, select: { likeCount: true } });
    return { liked: on, likeCount: post?.likeCount ?? 0 };
  }

  async setSave(userId: string, id: string, on: boolean) {
    await this.requirePublic(id);
    const exists = await this.db.workPostSave.findUnique({ where: { postId_userId: { postId: id, userId } } });
    if (on && !exists) {
      await this.db.$transaction([this.db.workPostSave.create({ data: { postId: id, userId } }), this.db.workPost.update({ where: { id }, data: { saveCount: { increment: 1 } } })]);
    } else if (!on && exists) {
      await this.db.$transaction([this.db.workPostSave.delete({ where: { postId_userId: { postId: id, userId } } }), this.db.workPost.update({ where: { id }, data: { saveCount: { decrement: 1 } } })]);
    }
    const post = await this.db.workPost.findUnique({ where: { id }, select: { saveCount: true } });
    return { saved: on, saveCount: post?.saveCount ?? 0 };
  }

  async setFollow(userId: string, masterId: string, on: boolean) {
    const master = await this.db.masterProfile.findUnique({ where: { id: masterId }, select: { userId: true } });
    if (!master) throw new NotFoundException(ERRORS.MASTER_NOT_FOUND);
    if (master.userId === userId) throw new BadRequestException(ERRORS.FEED_SELF_FOLLOW);
    if (on) await this.db.masterFollow.upsert({ where: { userId_masterId: { userId, masterId } }, create: { userId, masterId }, update: {} });
    else await this.db.masterFollow.deleteMany({ where: { userId, masterId } });
    const followers = await this.db.masterFollow.count({ where: { masterId } });
    return { following: on, followers };
  }

  async comments(id: string) {
    await this.requirePublic(id);
    const rows = await this.db.workPostComment.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, text: true, createdAt: true, userId: true, user: { select: { firstName: true, lastName: true, avatarAssetId: true, accountNumber: true } } },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        text: row.text,
        createdAt: row.createdAt,
        userId: row.userId,
        author: [row.user.firstName, row.user.lastName?.charAt(0) ? `${row.user.lastName.charAt(0)}.` : null].filter(Boolean).join(' ') || `ID ${row.user.accountNumber}`,
      })),
    };
  }

  async addComment(userId: string, id: string, dto: CreateCommentDto) {
    await this.requirePublic(id);
    const text = dto.text.trim();
    if (!text) throw new BadRequestException(ERRORS.MESSAGE_EMPTY);
    const [comment] = await this.db.$transaction([
      this.db.workPostComment.create({ data: { postId: id, userId, text }, select: { id: true } }),
      this.db.workPost.update({ where: { id }, data: { commentCount: { increment: 1 } } }),
    ]);
    return comment;
  }

  async removeComment(userId: string, id: string, commentId: string) {
    const comment = await this.db.workPostComment.findFirst({ where: { id: commentId, postId: id, OR: [{ userId }, { post: { master: { userId } } }] }, select: { id: true } });
    if (!comment) throw new NotFoundException(ERRORS.FEED_COMMENT_NOT_FOUND);
    await this.db.$transaction([this.db.workPostComment.delete({ where: { id: commentId } }), this.db.workPost.update({ where: { id }, data: { commentCount: { decrement: 1 } } })]);
    return { deleted: true };
  }

  // ---------- Yordamchi ----------

  private async requireMaster(userId: string) {
    const profile = await this.db.masterProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new ForbiddenException(ERRORS.MASTER_PROFILE_REQUIRED);
    return profile;
  }

  private async requirePublic(id: string) {
    const post = await this.db.workPost.findFirst({ where: { id, ...PUBLIC_WHERE }, select: { id: true } });
    if (!post) throw new NotFoundException(ERRORS.FEED_POST_NOT_FOUND);
  }

  private async requireAsset(userId: string, masterId: string, assetId: string, type: 'video' | 'image') {
    const asset = await this.db.mediaAsset.findUnique({ where: { id: assetId } });
    const mime = asset?.detectedMimeType ?? '';
    if (
      !asset ||
      asset.kind !== 'MASTER_PORTFOLIO' ||
      asset.uploaderId !== userId ||
      asset.linkedResourceType !== 'MasterProfile' ||
      asset.linkedResourceId !== masterId ||
      asset.status !== 'READY' ||
      !mime.startsWith(`${type}/`)
    ) {
      throw new BadRequestException(ERRORS.FEED_MEDIA_INVALID);
    }
  }

  private async present(userId: string, rows: PostRow[], apiBase: string) {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const masterIds = [...new Set(rows.map((row) => row.masterId))];
    const [likes, saves, follows, categories, services, urls] = await Promise.all([
      this.db.workPostLike.findMany({ where: { userId, postId: { in: ids } }, select: { postId: true } }),
      this.db.workPostSave.findMany({ where: { userId, postId: { in: ids } }, select: { postId: true } }),
      this.db.masterFollow.findMany({ where: { userId, masterId: { in: masterIds } }, select: { masterId: true } }),
      this.db.serviceCategory.findMany({ where: { id: { in: rows.map((row) => row.categoryId).filter((v): v is string => !!v) } }, select: { id: true, name: true } }),
      this.db.service.findMany({ where: { id: { in: rows.map((row) => row.serviceId).filter((v): v is string => !!v) } }, select: { id: true, name: true } }),
      this.media.signMany(rows.flatMap((row) => [row.videoAssetId, row.coverAssetId, row.beforeAssetId, row.afterAssetId].filter((v): v is string => !!v)), apiBase),
    ]);
    const liked = new Set(likes.map((row) => row.postId));
    const saved = new Set(saves.map((row) => row.postId));
    const following = new Set(follows.map((row) => row.masterId));
    const categoryName = new Map(categories.map((row) => [row.id, row.name]));
    const serviceName = new Map(services.map((row) => [row.id, row.name]));
    const image = (id: string | null) => (id ? (urls.get(id)?.medium ?? urls.get(id)?.original ?? null) : null);
    return rows.map((row) => {
      const user = row.master.user;
      return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        caption: row.caption,
        tags: row.tags,
        createdAt: row.createdAt,
        durationSec: row.durationSec,
        counts: { views: row.viewCount, likes: row.likeCount, saves: row.saveCount, comments: row.commentCount, shares: row.shareCount },
        viewer: { liked: liked.has(row.id), saved: saved.has(row.id), following: following.has(row.masterId), own: user.id === userId },
        category: row.categoryId ? { id: row.categoryId, name: categoryName.get(row.categoryId) ?? '' } : null,
        service: row.serviceId ? { id: row.serviceId, name: serviceName.get(row.serviceId) ?? '' } : null,
        media: {
          videoUrl: row.videoAssetId ? (urls.get(row.videoAssetId)?.original ?? null) : null,
          coverUrl: image(row.coverAssetId) ?? (row.kind === 'PHOTO' ? image(row.afterAssetId) : null),
          beforeUrl: image(row.beforeAssetId),
          afterUrl: image(row.afterAssetId),
        },
        master: {
          id: row.master.id,
          accountNumber: user.accountNumber,
          name: [user.firstName, user.lastName ? `${user.lastName.charAt(0)}.` : null].filter(Boolean).join(' ') || `Usta #${user.accountNumber}`,
          profession: row.master.profession,
          ratingAvg: Number(row.master.ratingAvg),
          ratingCount: row.master.ratingCount,
          completedOrders: row.master.completedOrders,
          experienceYears: row.master.experienceYears,
          isPro: row.master.isPro,
          verified: row.master.verification === 'VERIFIED',
        },
      };
    });
  }
}
