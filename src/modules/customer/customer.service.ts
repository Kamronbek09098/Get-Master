import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateProfileDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { SubscriptionService } from '../subscription/subscription.service';
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
  constructor(
    private readonly db: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

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
    await this.db.auditLog.create({
      data: { actorId: userId, action: 'CUSTOMER_PROFILE_UPDATED', targetType: 'User', targetId: userId },
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
      const created = await tx.address.create({
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
      await tx.auditLog.create({
        data: { actorId: userId, action: 'CUSTOMER_ADDRESS_CREATED', targetType: 'Address', targetId: created.id },
      });
      return created;
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
      const updated = await tx.address.update({
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
      await tx.auditLog.create({
        data: { actorId: userId, action: 'CUSTOMER_ADDRESS_UPDATED', targetType: 'Address', targetId: addressId },
      });
      return updated;
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
      await tx.auditLog.create({
        data: { actorId: userId, action: 'CUSTOMER_ADDRESS_REMOVED', targetType: 'Address', targetId: addressId },
      });
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

  /**
   * Ustaga mijozning qisqa ommaviy profili. Faqat mijoz bilan suhbati bor usta ko‘ra oladi; telefon, email va manzil berilmaydi.
   */
  async findPublicForMaster(masterUserId: string, accountNumber: number) {
    if (!Number.isSafeInteger(accountNumber) || accountNumber < 1 || accountNumber > 2_147_483_647) throw new NotFoundException(ERRORS.CUSTOMER_NOT_FOUND);
    const customer = await this.db.user.findFirst({
      where: { accountNumber, deletedAt: null, status: 'ACTIVE', userRoles: { none: { role: 'ADMIN' } } },
      select: { id: true, accountNumber: true, firstName: true, lastName: true, createdAt: true },
    });
    if (!customer) throw new NotFoundException(ERRORS.CUSTOMER_NOT_FOUND);
    const shared = await this.db.conversation.findFirst({
      where: { type: { not: 'SUPPORT' }, AND: [{ participants: { some: { userId: masterUserId } } }, { participants: { some: { userId: customer.id } } }] },
      select: { id: true },
    });
    if (!shared) throw new ForbiddenException(ERRORS.NOT_CONVERSATION_PARTICIPANT);
    const profile = await this.db.masterProfile.findUnique({ where: { userId: masterUserId }, select: { id: true } });
    const [completedOrders, ordersWithMe] = await Promise.all([
      this.db.order.count({ where: { customerId: customer.id, status: 'COMPLETED' } }),
      profile ? this.db.order.count({ where: { customerId: customer.id, masterId: profile.id } }) : Promise.resolve(0),
    ]);
    return {
      accountNumber: customer.accountNumber,
      firstName: customer.firstName,
      lastName: customer.lastName,
      memberSince: customer.createdAt,
      isPlus: !!(await this.subscriptions.activeFor(customer.id, 'CUSTOMER')),
      completedOrders,
      ordersWithMe,
      conversationId: shared.id,
    };
  }
}
