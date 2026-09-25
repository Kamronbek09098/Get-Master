import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import { CreateMasterServiceDto, UpdateMasterServiceDto } from './dto/master-service.dto';
import { ERRORS } from '../../common/constants/error-messages';

const MAX_SERVICES_PER_MASTER = 30;

const MASTER_SERVICE_SELECT = {
  id: true,
  serviceId: true,
  description: true,
  basePrice: true,
  estimatedMinutes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, name: true, slug: true, categoryId: true, isActive: true } },
} satisfies Prisma.MasterServiceSelect;

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'item';
}

@Injectable()
export class ServiceService {
  constructor(private readonly db: PrismaService) {}

  findAllCategories() {
    return this.db.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        services: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, slug: true, description: true },
        },
      },
    });
  }

  async findAll(query: ServiceQueryDto) {
    const rows = await this.db.service.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
        categoryId: query.categoryId,
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findOne(id: string) {
    const service = await this.db.service.findFirst({
      where: { id, isActive: true, category: { isActive: true } },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!service) throw new NotFoundException(ERRORS.SERVICE_NOT_FOUND);
    return service;
  }

  async assertCatalogSelection(
    categoryId?: string | null,
    serviceId?: string | null,
  ): Promise<{ categoryId: string | null; serviceId: string | null }> {
    if (serviceId) {
      const service = await this.db.service.findFirst({
        where: { id: serviceId, isActive: true, category: { isActive: true } },
        select: { categoryId: true },
      });
      if (!service) throw new BadRequestException(ERRORS.SELECTED_SERVICE_INVALID);
      if (categoryId && categoryId !== service.categoryId) {
        throw new BadRequestException(ERRORS.SERVICE_CATEGORY_MISMATCH);
      }
      return { categoryId: service.categoryId, serviceId };
    }
    if (categoryId) {
      const category = await this.db.serviceCategory.findFirst({ where: { id: categoryId, isActive: true } });
      if (!category) throw new BadRequestException(ERRORS.SELECTED_CATEGORY_INVALID);
    }
    return { categoryId: categoryId ?? null, serviceId: null };
  }

  async createCategory(actorId: string, dto: CreateCategoryDto) {
    const slug = await this.uniqueSlug('category', dto.name);
    const category = await this.db.serviceCategory.create({
      data: { name: dto.name.trim(), slug, description: dto.description, sortOrder: dto.sortOrder, isActive: dto.isActive },
    });
    await this.audit(actorId, 'SERVICE_CATEGORY_CREATED', 'ServiceCategory', category.id);
    return category;
  }

  async updateCategory(actorId: string, id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(id);
    const category = await this.db.serviceCategory.update({
      where: { id },
      data: { name: dto.name?.trim(), description: dto.description, sortOrder: dto.sortOrder, isActive: dto.isActive },
    });
    await this.audit(actorId, 'SERVICE_CATEGORY_UPDATED', 'ServiceCategory', id);
    return category;
  }

  async removeCategory(actorId: string, id: string) {
    await this.requireCategory(id);
    await this.db.$transaction([
      this.db.serviceCategory.update({ where: { id }, data: { isActive: false } }),
      this.db.service.updateMany({ where: { categoryId: id }, data: { isActive: false } }),
    ]);
    await this.audit(actorId, 'SERVICE_CATEGORY_DEACTIVATED', 'ServiceCategory', id);
    return { deactivated: true };
  }

  async create(actorId: string, dto: CreateServiceDto) {
    const category = await this.requireCategory(dto.categoryId);
    if (!category.isActive) throw new ConflictException(ERRORS.CATEGORY_INACTIVE);
    const slug = await this.uniqueSlug('service', dto.name);
    const service = await this.db.service.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        slug,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    await this.audit(actorId, 'SERVICE_CREATED', 'Service', service.id);
    return service;
  }

  async update(actorId: string, id: string, dto: UpdateServiceDto) {
    const current = await this.db.service.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(ERRORS.SERVICE_NOT_FOUND);
    if (dto.categoryId && dto.categoryId !== current.categoryId) await this.requireCategory(dto.categoryId);
    const service = await this.db.service.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        name: dto.name?.trim(),
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    await this.audit(actorId, 'SERVICE_UPDATED', 'Service', id);
    return service;
  }

  async remove(actorId: string, id: string) {
    const current = await this.db.service.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(ERRORS.SERVICE_NOT_FOUND);
    await this.db.service.update({ where: { id }, data: { isActive: false } });
    await this.audit(actorId, 'SERVICE_DEACTIVATED', 'Service', id);
    return { deactivated: true };
  }

  async findMyServices(userId: string) {
    const masterId = await this.masterIdOf(userId);
    return this.db.masterService.findMany({
      where: { masterId },
      select: MASTER_SERVICE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMyService(userId: string, dto: CreateMasterServiceDto) {
    const masterId = await this.masterIdOf(userId);
    await this.assertCatalogSelection(null, dto.serviceId);
    const count = await this.db.masterService.count({ where: { masterId } });
    if (count >= MAX_SERVICES_PER_MASTER) {
      throw new ConflictException(ERRORS.MAX_SERVICES(MAX_SERVICES_PER_MASTER));
    }
    try {
      return await this.db.masterService.create({
        data: {
          masterId,
          serviceId: dto.serviceId,
          description: dto.description,
          basePrice: dto.basePrice,
          estimatedMinutes: dto.estimatedMinutes,
          isActive: dto.isActive,
        },
        select: MASTER_SERVICE_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(ERRORS.SERVICE_ALREADY_OFFERED);
      }
      throw error;
    }
  }

  async updateMyService(userId: string, serviceId: string, dto: UpdateMasterServiceDto) {
    const masterId = await this.masterIdOf(userId);
    const existing = await this.db.masterService.findUnique({ where: { masterId_serviceId: { masterId, serviceId } } });
    if (!existing) throw new NotFoundException(ERRORS.SERVICE_NOT_OFFERED);
    return this.db.masterService.update({
      where: { id: existing.id },
      data: {
        description: dto.description,
        basePrice: dto.basePrice,
        estimatedMinutes: dto.estimatedMinutes,
        isActive: dto.isActive,
      },
      select: MASTER_SERVICE_SELECT,
    });
  }

  async removeMyService(userId: string, serviceId: string) {
    const masterId = await this.masterIdOf(userId);
    const result = await this.db.masterService.deleteMany({ where: { masterId, serviceId } });
    if (result.count === 0) throw new NotFoundException(ERRORS.SERVICE_NOT_OFFERED);
    const remaining = await this.db.masterService.count({
      where: { masterId, isActive: true, service: { isActive: true } },
    });
    if (remaining === 0) {
      await this.db.masterProfile.updateMany({ where: { id: masterId, status: 'ACTIVE' }, data: { status: 'INACTIVE' } });
    }
    return { deleted: true };
  }

  private async masterIdOf(userId: string): Promise<string> {
    const profile = await this.db.masterProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundException(ERRORS.MASTER_PROFILE_NOT_FOUND);
    return profile.id;
  }

  private async requireCategory(id: string) {
    const category = await this.db.serviceCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(ERRORS.CATEGORY_NOT_FOUND);
    return category;
  }

  private async uniqueSlug(kind: 'category' | 'service', name: string): Promise<string> {
    const base = slugify(name);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const taken =
        kind === 'category'
          ? await this.db.serviceCategory.findUnique({ where: { slug }, select: { id: true } })
          : await this.db.service.findUnique({ where: { slug }, select: { id: true } });
      if (!taken) return slug;
    }
    throw new ConflictException(ERRORS.SLUG_NOT_UNIQUE);
  }

  private audit(actorId: string, action: string, targetType: string, targetId: string) {
    return this.db.auditLog.create({ data: { actorId, action, targetType, targetId } });
  }
}
