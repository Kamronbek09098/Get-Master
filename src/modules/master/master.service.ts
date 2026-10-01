import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { toCursorPage, cursorArgs } from '../../common/utils/cursor';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import { MasterQueryDto } from './dto/master-query.dto';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto';
import { OpenRequestsQueryDto } from './dto/open-requests-query.dto';
import { MasterStatusDto, PauseMasterDto } from './dto/master-status.dto';
import { CreatePortfolioDto, UpdatePortfolioDto } from './dto/portfolio.dto';
import { ERRORS } from '../../common/constants/error-messages';

const MAX_PORTFOLIO_ITEMS = 20;

const PUBLIC_MASTER_SELECT = {
  id: true,
  profession: true,
  bio: true,
  experienceYears: true,
  workRadiusKm: true,
  serviceAreas: true,
  ratingAvg: true,
  ratingCount: true,
  completionRate: true,
  completedOrders: true,
  verification: true,
  user: { select: { accountNumber: true, firstName: true, lastName: true } },
  services: {
    where: { isActive: true, service: { isActive: true } },
    select: {
      serviceId: true,
      description: true,
      basePrice: true,
      estimatedMinutes: true,
      service: { select: { id: true, name: true, slug: true } },
    },
  },
  portfolio: {
    where: { status: 'APPROVED', mediaAsset: { status: 'READY' } },
    orderBy: { createdAt: 'desc' },
    take: MAX_PORTFOLIO_ITEMS,
    select: { id: true, title: true, description: true, mediaAssetId: true, createdAt: true },
  },
} satisfies Prisma.MasterProfileSelect;

@Injectable()
export class MasterService {
  private readonly logger = new Logger(MasterService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(userId: string, dto: CreateMasterDto) {
    const user = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { status: true },
    });
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException(ERRORS.ONLY_ACTIVE_CAN_BECOME_MASTER);

    try {
      const profile = await this.db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: this.nameData(dto) });
        const created = await tx.masterProfile.create({
          data: {
            userId,
            profession: dto.profession.trim(),
            bio: dto.bio?.trim(),
            experienceYears: dto.experienceYears,
            workRadiusKm: dto.workRadiusKm,
            latitude: dto.latitude,
            longitude: dto.longitude,
            serviceAreas: dto.serviceAreas as Prisma.InputJsonValue | undefined,
          },
        });
        await tx.userRole.createMany({ data: [{ userId, role: 'MASTER' }], skipDuplicates: true });
        await tx.auditLog.create({
          data: { actorId: userId, action: 'MASTER_PROFILE_CREATED', targetType: 'MasterProfile', targetId: created.id },
        });
        return created;
      });
      return profile;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(ERRORS.MASTER_PROFILE_EXISTS);
      }
      throw error;
    }
  }

  async findMe(userId: string) {
    const profile = await this.db.masterProfile.findUnique({
      where: { userId },
      include: { _count: { select: { services: true, portfolio: true, availability: true } } },
    });
    if (!profile) throw new NotFoundException(ERRORS.MASTER_PROFILE_NOT_FOUND);
    return profile;
  }

  async update(userId: string, dto: UpdateMasterDto) {
    const profile = await this.requireOwn(userId);
    await this.db.user.update({ where: { id: userId }, data: this.nameData(dto) });
    const updated = await this.db.masterProfile.update({
      where: { id: profile.id },
      data: {
        profession: dto.profession?.trim(),
        bio: dto.bio?.trim(),
        experienceYears: dto.experienceYears,
        workRadiusKm: dto.workRadiusKm,
        latitude: dto.latitude,
        longitude: dto.longitude,
        serviceAreas: dto.serviceAreas as Prisma.InputJsonValue | undefined,
      },
    });
    await this.db.auditLog.create({
      data: { actorId: userId, action: 'MASTER_PROFILE_UPDATED', targetType: 'MasterProfile', targetId: profile.id },
    });
    return updated;
  }

  private nameData(dto: { firstName?: string; lastName?: string }) {
    return { firstName: dto.firstName?.trim(), lastName: dto.lastName?.trim() };
  }

  async updateStatus(userId: string, dto: MasterStatusDto) {
    const profile = await this.requireOwn(userId);
    if (profile.status === 'RESTRICTED' || profile.status === 'SUSPENDED') {
      throw new ForbiddenException(ERRORS.PROFILE_STATUS_BLOCKED(profile.status));
    }
    if (dto.status === 'ACTIVE') {
      if (profile.verification !== 'VERIFIED') {
        throw new ConflictException(ERRORS.PROFILE_MUST_BE_VERIFIED);
      }
      if (!profile.profession) throw new ConflictException(ERRORS.PROFESSION_REQUIRED);
      const activeServices = await this.db.masterService.count({
        where: { masterId: profile.id, isActive: true, service: { isActive: true } },
      });
      if (activeServices === 0) throw new ConflictException(ERRORS.ACTIVE_SERVICE_REQUIRED);
    }
    const updated = await this.db.masterProfile.update({ where: { id: profile.id }, data: { status: dto.status } });
    await this.db.auditLog.create({
      data: {
        actorId: userId,
        action: 'MASTER_STATUS_CHANGED',
        targetType: 'MasterProfile',
        targetId: profile.id,
        before: { status: profile.status } as Prisma.InputJsonValue,
        after: { status: dto.status } as Prisma.InputJsonValue,
      },
    });
    return updated;
  }

  async pause(userId: string, dto: PauseMasterDto) {
    const profile = await this.requireOwn(userId);
    // Nofaol (yoki cheklangan) profil pauzaga o‘ta olmaydi: avval faol bo‘lishi kerak.
    if (profile.status !== 'ACTIVE' && profile.status !== 'BUSY') throw new BadRequestException(ERRORS.PAUSE_REQUIRES_ACTIVE);
    if (dto.until && dto.until <= new Date()) throw new BadRequestException(ERRORS.UNTIL_IN_FUTURE);
    const updated = await this.db.masterProfile.update({
      where: { id: profile.id },
      data: { isPaused: true, pauseReason: dto.reason, pausedUntil: dto.until ?? null },
    });
    await this.db.auditLog.create({
      data: { actorId: userId, action: 'MASTER_PAUSED', targetType: 'MasterProfile', targetId: profile.id, reason: dto.reason },
    });
    return updated;
  }

  async resume(userId: string) {
    const profile = await this.requireOwn(userId);
    const updated = await this.db.masterProfile.update({
      where: { id: profile.id },
      data: { isPaused: false, pauseReason: null, pausedUntil: null },
    });
    await this.db.auditLog.create({
      data: { actorId: userId, action: 'MASTER_RESUMED', targetType: 'MasterProfile', targetId: profile.id },
    });
    return updated;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async liftExpiredPauses(): Promise<void> {
    try {
      const { count } = await this.db.masterProfile.updateMany({
        where: { isPaused: true, pausedUntil: { lte: new Date() } },
        data: { isPaused: false, pauseReason: null, pausedUntil: null },
      });
      if (count > 0) this.logger.log(`Muddati tugagan ${count} ta usta pauzasi olib tashlandi`);
    } catch (error) {
      this.logger.error('Muddati tugagan pauzalarni olib tashlab bo‘lmadi', error instanceof Error ? error.stack : undefined);
    }
  }

  async findAll(query: MasterQueryDto) {
    const where: Prisma.MasterProfileWhereInput = {
      status: 'ACTIVE',
      verification: 'VERIFIED',
      isPaused: false,
      ...(query.minRating !== undefined ? { ratingAvg: { gte: query.minRating } } : {}),
      ...(query.serviceId || query.categoryId
        ? {
            services: {
              some: {
                isActive: true,
                serviceId: query.serviceId,
                service: { isActive: true, ...(query.categoryId ? { categoryId: query.categoryId } : {}) },
              },
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { profession: { contains: query.q, mode: 'insensitive' } },
              { user: { firstName: { contains: query.q, mode: 'insensitive' } } },
              { user: { lastName: { contains: query.q, mode: 'insensitive' } } },
              ...(/^\d{1,9}$/.test(query.q) ? [{ user: { accountNumber: Number(query.q) } }] : []),
            ],
          }
        : {}),
    };
    const rows = await this.db.masterProfile.findMany({
      where,
      select: PUBLIC_MASTER_SELECT,
      orderBy: [{ ratingAvg: 'desc' }, { id: 'asc' }],
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  /** Usta ochiq ID si — raqamli (akkaunt raqami); ichki UUID ham qabul qilinadi (backend ichida). */
  async findOne(idOrNumber: string) {
    const isNumber = /^\d{1,9}$/.test(idOrNumber);
    if (!isNumber && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrNumber)) throw new NotFoundException(ERRORS.MASTER_NOT_FOUND);
    const master = await this.db.masterProfile.findFirst({
      where: { ...(isNumber ? { user: { accountNumber: Number(idOrNumber) } } : { id: idOrNumber }), status: 'ACTIVE', verification: 'VERIFIED' },
      select: PUBLIC_MASTER_SELECT,
    });
    if (!master) throw new NotFoundException(ERRORS.MASTER_NOT_FOUND);
    return master;
  }

  /**
   * Faqat oldindan hisoblangan (async to‘lqinli) `MatchingResult`ga tayanish sahifani doim bo‘sh qoldirib
   * yuborishi mumkin (masalan usta hali `MasterService` qo‘shmagan yoki to‘lqin unga yetib bormagan bo‘lsa).
   * Shuning uchun so‘rov hali umuman moslashtirilmagan (birorta ham `matchingRun` yo‘q) bo‘lsa, ustaning
   * faol xizmat toifasiga mosligi kifoya. Ammo moslashtirish allaqachon o‘tgan bo‘lsa — ustani aniq NOTIFIED
   * qilmagan (masalan, faqat CANDIDATE sifatida baholab, e’lon qilmagan) so‘rovlar bu yerda ko‘rinmasligi kerak.
   */
  async findIncomingRequests(userId: string, query: CursorQueryDto) {
    const profile = await this.requireOwn(userId);
    const services = await this.db.masterService.findMany({
      where: { masterId: profile.id, isActive: true },
      select: { serviceId: true },
    });
    const serviceIds = services.map((service) => service.serviceId);
    const now = new Date();

    const filters: Prisma.ProblemRequestWhereInput[] = [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      {
        OR: [
          ...(serviceIds.length ? [{ serviceId: { in: serviceIds }, matchingRuns: { none: {} } }] : []),
          { matchingRuns: { some: { results: { some: { masterId: profile.id, status: 'NOTIFIED' } } } } },
        ],
      },
    ];

    const rows = await this.db.problemRequest.findMany({
      where: {
        status: { in: ['SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'] },
        customerId: { not: userId },
        AND: filters,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        preferredStartAt: true,
        preferredEndAt: true,
        expiresAt: true,
        createdAt: true,
        offers: { where: { masterId: profile.id }, select: { id: true, status: true } },
        matchingRuns: {
          select: { results: { where: { masterId: profile.id }, select: { id: true, score: true, createdAt: true } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map(({ matchingRuns, ...request }) => {
        const result = matchingRuns.flatMap((run) => run.results)[0] ?? null;
        return {
          id: result?.id ?? request.id,
          score: result?.score ?? null,
          createdAt: result?.createdAt ?? request.createdAt,
          request,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async findOpenRequests(userId: string, query: OpenRequestsQueryDto) {
    const profile = await this.requireOwn(userId);
    const services = await this.db.masterService.findMany({
      where: { masterId: profile.id, isActive: true },
      select: { serviceId: true, basePrice: true, estimatedMinutes: true },
    });
    const suggestions = new Map(services.map((item) => [item.serviceId, item]));
    const now = new Date();

    const filters: Prisma.ProblemRequestWhereInput[] = [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }];
    if (query.scope === 'mine') {
      filters.push({
        OR: [
          { serviceId: { in: [...suggestions.keys()] } },
          { matchingRuns: { some: { results: { some: { masterId: profile.id, status: 'NOTIFIED' } } } } },
        ],
      });
    }

    const rows = await this.db.problemRequest.findMany({
      where: {
        status: { in: ['SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'] },
        customerId: { not: userId },
        AND: filters,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        serviceId: true,
        preferredStartAt: true,
        preferredEndAt: true,
        expiresAt: true,
        createdAt: true,
        service: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { offers: true } },
        offers: { where: { masterId: profile.id }, select: { id: true, status: true, price: true } },
        matchingRuns: { select: { results: { where: { masterId: profile.id, status: 'NOTIFIED' }, select: { id: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map(({ offers, matchingRuns, _count, serviceId, ...request }) => {
        const suggestion = serviceId ? suggestions.get(serviceId) : undefined;
        return {
          ...request,
          offersCount: _count.offers,
          myOffer: offers[0] ?? null,
          notified: matchingRuns.some((run) => run.results.length > 0),
          suggested: suggestion ? { price: suggestion.basePrice, estimatedMinutes: suggestion.estimatedMinutes } : null,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async findAllPortfolio(userId: string) {
    const profile = await this.requireOwn(userId);
    return this.db.masterPortfolio.findMany({ where: { masterId: profile.id }, orderBy: { createdAt: 'desc' } });
  }

  async createPortfolio(userId: string, dto: CreatePortfolioDto) {
    const profile = await this.requireOwn(userId);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM master_profiles WHERE id = ${profile.id}::uuid FOR UPDATE`;
      const count = await tx.masterPortfolio.count({ where: { masterId: profile.id } });
      if (count >= MAX_PORTFOLIO_ITEMS) {
        throw new ConflictException(ERRORS.MAX_PORTFOLIO_ITEMS(MAX_PORTFOLIO_ITEMS));
      }
      const asset = await tx.mediaAsset.findUnique({ where: { id: dto.mediaAssetId } });
      if (
        !asset ||
        asset.kind !== 'MASTER_PORTFOLIO' ||
        asset.uploaderId !== userId ||
        asset.linkedResourceType !== 'MasterProfile' ||
        asset.linkedResourceId !== profile.id
      ) {
        throw new ForbiddenException(ERRORS.MEDIA_NOT_PORTFOLIO);
      }
      if (asset.status !== 'READY') throw new ConflictException(ERRORS.MEDIA_NOT_READY(asset.status));
      const mime = asset.detectedMimeType ?? '';
      if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
        throw new BadRequestException(ERRORS.PORTFOLIO_MEDIA_TYPE);
      }
      try {
        const created = await tx.masterPortfolio.create({
          data: { masterId: profile.id, mediaAssetId: asset.id, title: dto.title, description: dto.description },
        });
        await tx.auditLog.create({
          data: { actorId: userId, action: 'MASTER_PORTFOLIO_CREATED', targetType: 'MasterPortfolio', targetId: created.id },
        });
        return created;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(ERRORS.MEDIA_USED_PORTFOLIO);
        }
        throw error;
      }
    });
  }

  async updatePortfolio(userId: string, itemId: string, dto: UpdatePortfolioDto) {
    const profile = await this.requireOwn(userId);
    const item = await this.db.masterPortfolio.findFirst({ where: { id: itemId, masterId: profile.id } });
    if (!item) throw new NotFoundException(ERRORS.PORTFOLIO_ITEM_NOT_FOUND);
    const updated = await this.db.masterPortfolio.update({
      where: { id: itemId },
      data: {
        title: dto.title,
        description: dto.description,
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        rejectReason: null,
      },
    });
    await this.db.auditLog.create({
      data: { actorId: userId, action: 'MASTER_PORTFOLIO_UPDATED', targetType: 'MasterPortfolio', targetId: itemId },
    });
    return updated;
  }

  async removePortfolio(userId: string, itemId: string): Promise<{ deleted: true }> {
    const profile = await this.requireOwn(userId);
    const item = await this.db.masterPortfolio.findFirst({
      where: { id: itemId, masterId: profile.id },
      include: { mediaAsset: true },
    });
    if (!item) throw new NotFoundException(ERRORS.PORTFOLIO_ITEM_NOT_FOUND);

    await this.db.$transaction(async (tx) => {
      await tx.masterPortfolio.delete({ where: { id: itemId } });
      if (item.mediaAssetId) await tx.mediaAsset.delete({ where: { id: item.mediaAssetId } });
      await tx.auditLog.create({
        data: { actorId: userId, action: 'MASTER_PORTFOLIO_REMOVED', targetType: 'MasterPortfolio', targetId: itemId },
      });
    });

    const asset = item.mediaAsset;
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
    return { deleted: true };
  }

  private async requireOwn(userId: string) {
    const profile = await this.db.masterProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException(ERRORS.MASTER_PROFILE_NOT_FOUND);
    return profile;
  }
}
