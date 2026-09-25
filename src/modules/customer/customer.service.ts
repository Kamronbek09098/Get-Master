import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateProfileDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { ERRORS } from '../../common/constants/error-messages';

const DEFAULT_PREFERENCES = { language: 'UZ', currency: 'UZS', notificationsEnabled: true } as const;

const MAX_ADDRESSES = 20;

const PROFILE_SELECT = {
  id: true,
  accountNumber: true,
  phone: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  phoneVerifiedAt: true,
  createdAt: true,
  userRoles: { select: { role: true } },
  masterProfile: { select: { id: true, status: true, verification: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class CustomerService {
  constructor(private readonly db: PrismaService) {}

  /** Menyu belgisi: oxirgi kirishdan keyin so‘rovlarga kelgan yangi takliflar soni. */
  async getBadges(userId: string, offersSince?: string) {
    const since = offersSince ? new Date(offersSince) : null;
    const offers =
      since && !Number.isNaN(since.getTime())
        ? await this.db.offer.count({ where: { status: 'PENDING', createdAt: { gt: since }, request: { customerId: userId } } })
        : 0;
    return { offers, now: new Date().toISOString() };
  }

  async findOne(userId: string) {
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null }, select: PROFILE_SELECT });
    if (!user) throw new NotFoundException(ERRORS.CUSTOMER_NOT_FOUND);
    const { userRoles, ...rest } = user;
    return { ...rest, roles: userRoles.map((item) => item.role), phoneVerified: !!user.phoneVerifiedAt };
  }

  async update(userId: string, dto: UpdateProfileDto) {
    await this.findOne(userId);
    await this.db.user.update({
      where: { id: userId },
      data: { firstName: dto.firstName?.trim(), lastName: dto.lastName?.trim() },
    });
    return this.findOne(userId);
  }

  async findPreferences(userId: string) {
    const user = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { preferences: true },
    });
    if (!user) throw new NotFoundException(ERRORS.CUSTOMER_NOT_FOUND);
    return { ...DEFAULT_PREFERENCES, ...((user.preferences as Prisma.JsonObject | null) ?? {}) };
  }

  async updatePreferences(userId: string, dto: UpdateCustomerDto) {
    const current = await this.findPreferences(userId);
    const next = { ...current, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) };
    await this.db.user.update({ where: { id: userId }, data: { preferences: next as Prisma.InputJsonValue } });
    return next;
  }

  findAllAddresses(userId: string) {
    return this.db.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    return this.db.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const count = await tx.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES) throw new ConflictException(ERRORS.MAX_ADDRESSES(MAX_ADDRESSES));
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      return tx.address.create({
        data: {
          userId,
          title: dto.title,
          addressLine: dto.addressLine.trim(),
          city: dto.city,
          district: dto.district,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault: makeDefault,
        },
      });
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    return this.db.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const current = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!current) throw new NotFoundException(ERRORS.ADDRESS_NOT_FOUND);
      if (dto.isDefault === true) {
        await tx.address.updateMany({ where: { userId, isDefault: true, id: { not: addressId } }, data: { isDefault: false } });
      }
      const isDefault = current.isDefault ? true : dto.isDefault;
      return tx.address.update({
        where: { id: addressId },
        data: {
          title: dto.title,
          addressLine: dto.addressLine?.trim(),
          city: dto.city,
          district: dto.district,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault,
        },
      });
    });
  }

  async removeAddress(userId: string, addressId: string): Promise<{ deleted: true }> {
    await this.db.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const current = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!current) throw new NotFoundException(ERRORS.ADDRESS_NOT_FOUND);
      await tx.address.delete({ where: { id: addressId } });
      if (current.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return { deleted: true };
  }

  async assertOwnsAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.db.address.findUnique({ where: { id: addressId }, select: { userId: true } });
    if (!address) throw new NotFoundException(ERRORS.ADDRESS_NOT_FOUND);
    if (address.userId !== userId) throw new ForbiddenException(ERRORS.NOT_ADDRESS_OWNER);
  }

  private async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  }
}
