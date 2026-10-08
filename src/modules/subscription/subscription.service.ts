import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, Role, Subscription, SubscriptionAudience } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { ERRORS } from '../../common/constants/error-messages';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TelegramAlertService } from '../../infrastructure/telegram/telegram-alert.service';
import { NotificationService } from '../notification/notification.service';
import type { GrantSubscriptionDto, RequestSubscriptionDto } from './dto/subscription.dto';
import { Feature, PAYMENT_METHODS, PLANS, PlanDef, planByCode } from './plans.config';

const REMINDER_DAYS = 3;
const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};
const fullName = (user: { firstName: string | null; lastName: string | null; phone: string | null }) => [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone || '—';

const view = (row: Subscription) => ({
  id: row.id,
  audience: row.audience,
  planCode: row.planCode,
  months: row.months,
  amount: row.amount.toString(),
  currency: row.currency,
  status: row.status,
  source: row.source,
  method: row.method,
  reference: row.reference,
  note: row.note,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  rejectReason: row.rejectReason,
  createdAt: row.createdAt,
});

/** Obunalar: tarif rejalari, to‘lov so‘rovi, admin tasdig‘i/sovg‘asi, muddat tugashi va imkoniyatlarni tekshirish. */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly telegram: TelegramAlertService,
  ) {}

  // ---------- imkoniyatlarni tekshirish ----------

  /** Hozir amal qilayotgan obuna (audience bo‘yicha). */
  async activeFor(userId: string, audience: SubscriptionAudience, db: Prisma.TransactionClient | PrismaService = this.db) {
    const now = new Date();
    return db.subscription.findFirst({
      where: { userId, audience, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });
  }

  async hasFeature(userId: string, feature: Feature): Promise<boolean> {
    const plan = PLANS.find((item) => item.features.includes(feature));
    if (!plan) return false;
    return !!(await this.activeFor(userId, plan.audience));
  }

  /** Bir nechta foydalanuvchidan qaysilarida «Pro» (usta) / «Plus» (mijoz) faol. */
  async activeUserIds(userIds: string[], audience: SubscriptionAudience): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const now = new Date();
    const rows = await this.db.subscription.findMany({
      where: { userId: { in: userIds }, audience, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      select: { userId: true },
    });
    return new Set(rows.map((row) => row.userId));
  }

  // ---------- foydalanuvchi ----------

  plans() {
    const methods = (this.config.get<string>('SUBSCRIPTION_METHODS') ?? PAYMENT_METHODS.join(','))
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is (typeof PAYMENT_METHODS)[number] => (PAYMENT_METHODS as readonly string[]).includes(item));
    return {
      plans: PLANS.map((plan) => ({
        code: plan.code,
        audience: plan.audience,
        name: plan.name,
        tagline: plan.tagline,
        features: plan.features,
        prices: Object.entries(plan.prices).map(([months, price]) => ({
          months: Number(months),
          price,
          // Uzoq muddatda tejash: 1 oylik narxga nisbatan chegirma foizi.
          savingPercent: Math.round((1 - price / (plan.prices[1] * Number(months))) * 100),
        })),
      })),
      methods,
      currency: 'UZS',
    };
  }

  async me(userId: string) {
    const [rows, pending] = await Promise.all([
      this.db.subscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.db.subscription.findMany({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
    ]);
    const now = new Date();
    const active = rows.filter((row) => row.status === 'ACTIVE' && row.startsAt && row.endsAt && row.startsAt <= now && row.endsAt > now);
    const current = (audience: SubscriptionAudience) => {
      const own = active.filter((row) => row.audience === audience).sort((a, b) => (b.endsAt?.getTime() ?? 0) - (a.endsAt?.getTime() ?? 0))[0];
      if (!own) return null;
      // Navbatdagi (keyingi) obunalar bilan birga umumiy tugash sanasi.
      const untilAll = rows.filter((row) => row.audience === audience && row.status === 'ACTIVE' && row.endsAt && row.endsAt > now).reduce((max, row) => Math.max(max, row.endsAt!.getTime()), 0);
      return { ...view(own), endsAtTotal: new Date(untilAll) };
    };
    return {
      customer: current('CUSTOMER'),
      master: current('MASTER'),
      pending: pending.map(view),
      history: rows.filter((row) => row.status !== 'PENDING').map(view),
      instructions: this.instructions(),
    };
  }

  private instructions() {
    return {
      card: this.config.get<string>('SUBSCRIPTION_PAY_CARD') ?? '',
      holder: this.config.get<string>('SUBSCRIPTION_PAY_HOLDER') ?? '',
      note: this.config.get<string>('SUBSCRIPTION_PAY_NOTE') ?? '',
    };
  }

  async request(userId: string, roles: Role[], dto: RequestSubscriptionDto) {
    const plan = planByCode(dto.planCode) as PlanDef;
    if (plan.audience === 'MASTER') {
      const profile = await this.db.masterProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!roles.includes(Role.MASTER) || !profile) throw new ForbiddenException(ERRORS.SUBSCRIPTION_MASTER_ONLY);
    } else if (!roles.includes(Role.CUSTOMER)) {
      throw new ForbiddenException(ERRORS.SUBSCRIPTION_CUSTOMER_ONLY);
    }
    const waiting = await this.db.subscription.findFirst({ where: { userId, audience: plan.audience, status: 'PENDING' }, select: { id: true } });
    if (waiting) throw new ConflictException(ERRORS.SUBSCRIPTION_PENDING_EXISTS);
    const created = await this.db.subscription.create({
      data: {
        userId,
        audience: plan.audience,
        planCode: plan.code,
        months: dto.months,
        amount: plan.prices[dto.months],
        status: 'PENDING',
        source: 'PURCHASE',
        method: dto.method,
        reference: `GM-${randomBytes(4).toString('hex').toUpperCase()}`,
      },
    });
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { accountNumber: true, firstName: true, lastName: true, phone: true } });
    if (user) {
      this.telegram.notifySubscriptionRequested({ name: fullName(user), account: user.accountNumber, phone: user.phone, plan: `${plan.name} · ${dto.months} oy`, amount: Number(created.amount), method: dto.method, reference: created.reference });
    }
    return { ...view(created), instructions: this.instructions() };
  }

  async cancelRequest(userId: string, id: string) {
    const row = await this.db.subscription.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(ERRORS.SUBSCRIPTION_NOT_FOUND);
    if (row.status !== 'PENDING') throw new ConflictException(ERRORS.SUBSCRIPTION_NOT_PENDING);
    const updated = await this.db.subscription.update({ where: { id }, data: { status: 'CANCELED' } });
    return view(updated);
  }

  // ---------- admin ----------

  async adminList(query: { status?: Subscription['status']; page?: number }) {
    const limit = 30;
    const page = Math.max(query.page ?? 1, 1);
    const where: Prisma.SubscriptionWhereInput = query.status ? { status: query.status } : {};
    const [total, rows, counts] = await Promise.all([
      this.db.subscription.count({ where }),
      this.db.subscription.findMany({
        where,
        orderBy: query.status === 'PENDING' ? { createdAt: 'asc' } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } } },
      }),
      this.db.subscription.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      items: rows.map((row) => ({ ...view(row), user: { id: row.user.id, accountNumber: row.user.accountNumber, name: fullName(row.user), phone: row.user.phone } })),
      total,
      page,
      limit,
      counts: Object.fromEntries(counts.map((item) => [item.status, item._count])),
    };
  }

  async approve(adminId: string, id: string) {
    const row = await this.db.subscription.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(ERRORS.SUBSCRIPTION_NOT_FOUND);
    if (row.status !== 'PENDING') throw new ConflictException(ERRORS.SUBSCRIPTION_NOT_PENDING);
    const activated = await this.db.$transaction(async (tx) => {
      const updated = await this.activate(tx, row);
      await tx.subscription.update({ where: { id }, data: { decidedById: adminId, decidedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SUBSCRIPTION_APPROVED', targetType: 'Subscription', targetId: id, after: { userId: row.userId, plan: row.planCode, months: row.months } } });
      return updated;
    });
    await this.notifyUser(row.userId, 'subscription.activated', 'Obuna faollashtirildi', `${planByCode(row.planCode)?.name ?? ''} obunangiz ${row.months} oyga faollashtirildi.`);
    return view(activated);
  }

  async reject(adminId: string, id: string, reason: string) {
    const row = await this.db.subscription.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(ERRORS.SUBSCRIPTION_NOT_FOUND);
    if (row.status !== 'PENDING') throw new ConflictException(ERRORS.SUBSCRIPTION_NOT_PENDING);
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.subscription.update({ where: { id }, data: { status: 'REJECTED', rejectReason: reason.trim(), decidedById: adminId, decidedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SUBSCRIPTION_REJECTED', targetType: 'Subscription', targetId: id, reason } });
      return next;
    });
    await this.notifyUser(row.userId, 'subscription.rejected', 'Obuna so‘rovi rad etildi', `Sabab: ${reason.trim()}.`);
    return view(updated);
  }

  /** Admin sovg‘asi: to‘lovsiz obuna beradi (masalan, aksiya yoki sinov uchun). */
  async grant(adminId: string, dto: GrantSubscriptionDto) {
    const plan = planByCode(dto.planCode) as PlanDef;
    const isNumber = /^\d{1,9}$/.test(dto.user.trim());
    const user = await this.db.user.findFirst({
      where: { ...(isNumber ? { accountNumber: Number(dto.user.trim()) } : { id: dto.user.trim() }), deletedAt: null, status: 'ACTIVE' },
      select: { id: true, userRoles: { select: { role: true } } },
    });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (plan.audience === 'MASTER' && !user.userRoles.some((item) => item.role === Role.MASTER)) throw new BadRequestException(ERRORS.SUBSCRIPTION_MASTER_ONLY);
    const created = await this.db.$transaction(async (tx) => {
      const row = await tx.subscription.create({
        data: { userId: user.id, audience: plan.audience, planCode: plan.code, months: dto.months, amount: 0, status: 'PENDING', source: 'GRANT', reference: `GM-${randomBytes(4).toString('hex').toUpperCase()}`, note: dto.note?.trim() || null, decidedById: adminId, decidedAt: new Date() },
      });
      const active = await this.activate(tx, row);
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SUBSCRIPTION_GRANTED', targetType: 'Subscription', targetId: row.id, after: { userId: user.id, plan: plan.code, months: dto.months, note: dto.note ?? null } } });
      return active;
    });
    await this.notifyUser(user.id, 'subscription.activated', 'Sizga obuna sovg‘a qilindi', `${plan.name} obunasi ${dto.months} oyga faollashtirildi.`);
    return view(created);
  }

  async revoke(adminId: string, id: string, reason: string) {
    const row = await this.db.subscription.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(ERRORS.SUBSCRIPTION_NOT_FOUND);
    if (row.status !== 'ACTIVE') throw new ConflictException(ERRORS.SUBSCRIPTION_NOT_ACTIVE);
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.subscription.update({ where: { id }, data: { status: 'CANCELED', endsAt: new Date(), note: [row.note, `Bekor qilindi: ${reason}`].filter(Boolean).join(' · ') } });
      await this.syncMasterPro(tx, row.userId);
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SUBSCRIPTION_REVOKED', targetType: 'Subscription', targetId: id, reason } });
      return next;
    });
    await this.notifyUser(row.userId, 'subscription.expired', 'Obuna bekor qilindi', `Obunangiz administrator tomonidan bekor qilindi: ${reason}.`);
    return view(updated);
  }

  // ---------- ichki ----------

  /** PENDING yozuvni faollashtiradi: boshlanishi — mavjud obuna tugagan paytdan (davom ettirish), aks holda hozir. */
  private async activate(tx: Prisma.TransactionClient, row: Subscription) {
    const latest = await tx.subscription.findFirst({
      where: { userId: row.userId, audience: row.audience, status: 'ACTIVE', endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'desc' },
      select: { endsAt: true },
    });
    const startsAt = latest?.endsAt ?? new Date();
    const updated = await tx.subscription.update({ where: { id: row.id }, data: { status: 'ACTIVE', startsAt, endsAt: addMonths(startsAt, row.months) } });
    await this.syncMasterPro(tx, row.userId);
    return updated;
  }

  /** Ustaning «Pro» belgisi (katalog tartibi uchun) obuna holatiga moslab yangilanadi. */
  async syncMasterPro(db: Prisma.TransactionClient | PrismaService, userId: string) {
    const now = new Date();
    const latest = await db.subscription.findFirst({
      where: { userId, audience: 'MASTER', status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
      select: { endsAt: true },
    });
    await db.masterProfile.updateMany({ where: { userId }, data: { isPro: !!latest, proUntil: latest?.endsAt ?? null } });
  }

  private async notifyUser(userId: string, template: string, title: string, body: string) {
    await this.notifications.create({ userId, channel: 'IN_APP', title, body, template, data: {} }).catch((error) => this.logger.warn(`Obuna bildirishnomasi yuborilmadi: ${(error as Error).message}`));
  }

  /** Muddati tugagan obunalarni yopadi va tugashiga 3 kun qolganda eslatadi. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweep() {
    try {
      const now = new Date();
      const due = await this.db.subscription.findMany({ where: { status: 'ACTIVE', endsAt: { lte: now } }, select: { id: true, userId: true, audience: true, planCode: true } });
      for (const row of due) {
        await this.db.subscription.update({ where: { id: row.id }, data: { status: 'EXPIRED' } });
        const stillActive = await this.activeFor(row.userId, row.audience);
        if (row.audience === 'MASTER') await this.syncMasterPro(this.db, row.userId);
        if (!stillActive) await this.notifyUser(row.userId, 'subscription.expired', 'Obuna muddati tugadi', `${planByCode(row.planCode)?.name ?? ''} obunangiz tugadi. Qayta obuna bo‘lib, imkoniyatlarni tiklashingiz mumkin.`);
      }
      const soon = await this.db.subscription.findMany({
        where: { status: 'ACTIVE', reminderSent: false, endsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_DAYS * 86_400_000) } },
        select: { id: true, userId: true, audience: true, planCode: true, endsAt: true },
      });
      for (const row of soon) {
        // Navbatda keyingi obuna bo‘lsa, eslatma kerak emas.
        const queued = await this.db.subscription.count({ where: { userId: row.userId, audience: row.audience, status: 'ACTIVE', startsAt: { gte: row.endsAt! } } });
        await this.db.subscription.update({ where: { id: row.id }, data: { reminderSent: true } });
        if (queued === 0) await this.notifyUser(row.userId, 'subscription.reminder', 'Obuna tez orada tugaydi', `${planByCode(row.planCode)?.name ?? ''} obunangiz ${REMINDER_DAYS} kundan kamroq vaqtdan keyin tugaydi.`);
      }
    } catch (error) {
      this.logger.error('Obunalarni tekshirib bo‘lmadi', error instanceof Error ? error.stack : undefined);
    }
  }
}
