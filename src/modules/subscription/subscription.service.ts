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
import { Feature, PAYMENT_METHODS, PLANS, PaymentMethod, PlanDef, planByCode } from './plans.config';

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
  paidAt: row.paidAt,
  hasReceipt: !!row.receiptAssetId,
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

  /** Onlayn usullar faqat to‘lov tizimi sozlangan bo‘lsa taklif qilinadi; karta o‘tkazmasi (chek bilan) doim bor. */
  availableMethods(): PaymentMethod[] {
    const get = (key: string) => this.config.get<string>(key, '');
    const online: Record<string, boolean> = {
      CLICK: !!(get('payment.click.merchantId') && get('payment.click.serviceId') && get('payment.click.secretKey')),
      PAYME: !!(get('payment.payme.merchantId') && get('payment.payme.secretKey')),
      UZUM: !!(get('payment.uzum.merchantId') && get('payment.uzum.secretKey')),
      CARD: true,
    };
    const wanted = (this.config.get<string>('SUBSCRIPTION_METHODS') ?? PAYMENT_METHODS.join(',')).split(',').map((item) => item.trim());
    return PAYMENT_METHODS.filter((method) => wanted.includes(method) && online[method]);
  }

  plans() {
    const methods = this.availableMethods();
    // Barcha usullar ko‘rsatiladi; to‘lov tizimi hali ulanmagan bo‘lsa — «tez orada» deb belgilanadi va tanlab bo‘lmaydi.
    const wanted = (this.config.get<string>('SUBSCRIPTION_METHODS') ?? PAYMENT_METHODS.join(',')).split(',').map((item) => item.trim());
    const allMethods = PAYMENT_METHODS.filter((method) => wanted.includes(method)).map((method) => ({ method, available: methods.includes(method) }));
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
      allMethods,
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
      pending: pending.map((row) => ({ ...view(row), checkoutUrl: this.checkoutUrl(row) })),
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

  /** Click / Payme to‘lov sahifasi havolasi (to‘lov muvaffaqiyatli bo‘lsa obuna darhol faollashadi). */
  checkoutUrl(row: { id: string; amount: Prisma.Decimal | number | string; method: string | null }): string | null {
    const returnUrl = this.config.get<string>('payment.returnUrl', '');
    if (row.method === 'CLICK') {
      const params = new URLSearchParams({
        service_id: this.config.get<string>('payment.click.serviceId', ''),
        merchant_id: this.config.get<string>('payment.click.merchantId', ''),
        amount: Number(row.amount).toFixed(2),
        transaction_param: row.id,
        ...(returnUrl ? { return_url: returnUrl } : {}),
      });
      return `https://my.click.uz/services/pay?${params.toString()}`;
    }
    if (row.method === 'PAYME') {
      const raw = `m=${this.config.get<string>('payment.payme.merchantId', '')};ac.order_id=${row.id};a=${Math.round(Number(row.amount) * 100)}`;
      const host = this.config.get<boolean>('payment.payme.testMode', true) ? 'checkout.test.paycom.uz' : 'checkout.paycom.uz';
      return `https://${host}/${Buffer.from(raw).toString('base64')}`;
    }
    if (row.method === 'UZUM') return `${this.config.get<string>('payment.uzum.checkoutBase', '') || 'https://payment.example/checkout'}/${row.id}`;
    return null;
  }

  async request(userId: string, roles: Role[], dto: RequestSubscriptionDto) {
    const plan = planByCode(dto.planCode) as PlanDef;
    if (!this.availableMethods().includes(dto.method)) throw new BadRequestException(ERRORS.SUBSCRIPTION_METHOD_UNAVAILABLE);
    if (plan.audience === 'MASTER') {
      const profile = await this.db.masterProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!roles.includes(Role.MASTER) || !profile) throw new ForbiddenException(ERRORS.SUBSCRIPTION_MASTER_ONLY);
    } else if (!roles.includes(Role.CUSTOMER)) {
      throw new ForbiddenException(ERRORS.SUBSCRIPTION_CUSTOMER_ONLY);
    }
    const waiting = await this.db.subscription.findFirst({ where: { userId, audience: plan.audience, status: 'PENDING' } });
    if (waiting) {
      // Chek yuklangan (admin ko‘rib chiqayotgan) so‘rov bo‘lsa — yangisi ochilmaydi; to‘lanmagan urinish esa yangisi bilan almashtiriladi.
      if (waiting.method === 'CARD' && waiting.receiptAssetId) throw new ConflictException(ERRORS.SUBSCRIPTION_PENDING_EXISTS);
      await this.db.subscription.update({ where: { id: waiting.id }, data: { status: 'CANCELED', note: 'Yangi so‘rov bilan almashtirildi' } });
    }
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
    if (dto.method === 'CARD') {
      const user = await this.db.user.findUnique({ where: { id: userId }, select: { accountNumber: true, firstName: true, lastName: true, phone: true } });
      if (user) {
        this.telegram.notifySubscriptionRequested({ name: fullName(user), account: user.accountNumber, phone: user.phone, plan: `${plan.name} · ${dto.months} oy`, amount: Number(created.amount), method: 'Karta (chek kutilmoqda)', reference: created.reference });
      }
    }
    return { ...view(created), checkoutUrl: this.checkoutUrl(created), instructions: this.instructions() };
  }

  /** Karta o‘tkazmasi cheki: foydalanuvchi yuklagan fayl so‘rovga biriktiriladi (admin ko‘rib chiqadi). */
  async attachReceipt(userId: string, id: string, mediaAssetId: string) {
    const row = await this.db.subscription.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(ERRORS.SUBSCRIPTION_NOT_FOUND);
    if (row.status !== 'PENDING' || row.method !== 'CARD') throw new ConflictException(ERRORS.SUBSCRIPTION_NOT_PENDING);
    const asset = await this.db.mediaAsset.findFirst({ where: { id: mediaAssetId, uploaderId: userId, kind: 'SUBSCRIPTION_RECEIPT', linkedResourceType: 'Subscription', linkedResourceId: id } });
    if (!asset) throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);
    if (asset.status !== 'READY') throw new ConflictException(ERRORS.SUBSCRIPTION_RECEIPT_NOT_READY);
    const updated = await this.db.subscription.update({ where: { id }, data: { receiptAssetId: asset.id, providerMeta: { receiptAt: new Date().toISOString() } } });
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { accountNumber: true, firstName: true, lastName: true, phone: true } });
    if (user) this.telegram.notifySubscriptionRequested({ name: fullName(user), account: user.accountNumber, phone: user.phone, plan: `${planByCode(row.planCode)?.name ?? row.planCode} · ${row.months} oy`, amount: Number(row.amount), method: 'Karta — CHEK YUKLANDI', reference: row.reference });
    return view(updated);
  }

  async cancelRequest(userId: string, id: string) {
    const row = await this.db.subscription.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(ERRORS.SUBSCRIPTION_NOT_FOUND);
    if (row.status !== 'PENDING') throw new ConflictException(ERRORS.SUBSCRIPTION_NOT_PENDING);
    const updated = await this.db.subscription.update({ where: { id }, data: { status: 'CANCELED' } });
    return view(updated);
  }

  // ---------- admin ----------

  async adminList(query: { status?: Subscription['status']; page?: number; q?: string; method?: string }) {
    const limit = 30;
    const page = Math.max(query.page ?? 1, 1);
    const q = query.q?.trim();
    const and: Prisma.SubscriptionWhereInput[] = [];
    if (q) {
      const numeric = /^\d{1,9}$/.test(q) ? Number(q) : null;
      and.push({
        OR: [
          { reference: { contains: q.toUpperCase() } },
          { user: { phone: { contains: q } } },
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
          ...(numeric !== null ? [{ user: { accountNumber: numeric } }] : []),
        ],
      });
    }
    if (query.method) and.push({ method: query.method });
    const where: Prisma.SubscriptionWhereInput = { ...(query.status ? { status: query.status } : {}), ...(and.length ? { AND: and } : {}) };
    const [total, rows, counts] = await Promise.all([
      this.db.subscription.count({ where }),
      this.db.subscription.findMany({
        where,
        orderBy: query.status === 'PENDING' ? [{ receiptAssetId: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }] : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } } },
      }),
      this.db.subscription.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      items: rows.map((row) => ({
        ...view(row),
        receiptAssetId: row.receiptAssetId,
        providerTxId: row.providerTxId,
        user: { id: row.user.id, accountNumber: row.user.accountNumber, name: fullName(row.user), phone: row.user.phone },
      })),
      total,
      page,
      limit,
      counts: Object.fromEntries(counts.map((item) => [item.status, item._count])),
    };
  }

  /** Superadmin uchun umumiy ko‘rinish: faol obunalar, kutilayotgan cheklar, tushum (usul va reja bo‘yicha). */
  async adminSummary() {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const [active, pendingReceipts, pendingNoReceipt, paid30, paidAll] = await Promise.all([
      this.db.subscription.groupBy({ by: ['audience'], where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } }, _count: true }),
      this.db.subscription.count({ where: { status: 'PENDING', method: 'CARD', receiptAssetId: { not: null } } }),
      this.db.subscription.count({ where: { status: 'PENDING', receiptAssetId: null } }),
      this.db.subscription.groupBy({ by: ['method'], where: { source: 'PURCHASE', status: { in: ['ACTIVE', 'EXPIRED'] }, paidAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      this.db.subscription.groupBy({ by: ['planCode'], where: { source: 'PURCHASE', status: { in: ['ACTIVE', 'EXPIRED'] } }, _sum: { amount: true }, _count: true }),
    ]);
    const sum = (rows: Array<{ _sum: { amount: Prisma.Decimal | null } }>) => rows.reduce((total, row) => total + Number(row._sum.amount ?? 0), 0);
    return {
      activeCustomers: active.find((row) => row.audience === 'CUSTOMER')?._count ?? 0,
      activeMasters: active.find((row) => row.audience === 'MASTER')?._count ?? 0,
      pendingReceipts,
      pendingNoReceipt,
      revenue30d: sum(paid30),
      revenueTotal: sum(paidAll),
      byMethod30d: paid30.map((row) => ({ method: row.method ?? '—', count: row._count, amount: Number(row._sum.amount ?? 0) })),
      byPlan: paidAll.map((row) => ({ planCode: row.planCode, count: row._count, amount: Number(row._sum.amount ?? 0) })),
    };
  }

  async approve(adminId: string, id: string) {
    const row = await this.db.subscription.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(ERRORS.SUBSCRIPTION_NOT_FOUND);
    if (row.status !== 'PENDING') throw new ConflictException(ERRORS.SUBSCRIPTION_NOT_PENDING);
    // Click/Payme/Uzum to‘lovlari avtomatik faollashadi; admin faqat karta chekini ko‘rib chiqadi.
    if (row.method !== 'CARD') throw new ConflictException(ERRORS.SUBSCRIPTION_AUTO_ONLY);
    if (!row.receiptAssetId) throw new ConflictException(ERRORS.SUBSCRIPTION_RECEIPT_REQUIRED);
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
    if (row.method !== 'CARD') throw new ConflictException(ERRORS.SUBSCRIPTION_AUTO_ONLY);
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

  // ---------- to‘lov tizimlari (Click / Payme / Uzum) ----------

  /** To‘lov tizimi so‘rovi bo‘yicha obuna (id — tranzaksiya parametri). */
  async gatewayFind(id: string, method: 'CLICK' | 'PAYME' | 'UZUM') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
    return this.db.subscription.findFirst({ where: { id, method, source: 'PURCHASE' } });
  }

  async gatewayFindByTx(method: 'PAYME' | 'CLICK' | 'UZUM', txId: string) {
    return this.db.subscription.findFirst({ where: { method, providerTxId: txId } });
  }

  async gatewayStatement(from: number, to: number) {
    return this.db.subscription.findMany({ where: { method: 'PAYME', providerTxId: { not: null }, createdAt: { gte: new Date(from), lte: new Date(to) } }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  /** Protokol holatini (Click prepare, Payme tranzaksiya) saqlaydi. */
  async gatewayUpdate(id: string, data: { providerTxId?: string; meta?: Record<string, unknown> }) {
    const row = await this.db.subscription.findUniqueOrThrow({ where: { id }, select: { providerMeta: true } });
    return this.db.subscription.update({
      where: { id },
      data: {
        ...(data.providerTxId ? { providerTxId: data.providerTxId } : {}),
        ...(data.meta ? { providerMeta: { ...((row.providerMeta as object | null) ?? {}), ...data.meta } as Prisma.InputJsonValue } : {}),
      },
    });
  }

  /** To‘lov muvaffaqiyatli: admin ruxsatisiz obuna darhol faollashadi (takroriy chaqiruv xavfsiz). */
  async gatewayPaid(id: string, txId: string, meta?: Record<string, unknown>) {
    const result = await this.db.$transaction(async (tx) => {
      const row = await tx.subscription.findUniqueOrThrow({ where: { id } });
      if (row.status === 'ACTIVE' || row.status === 'EXPIRED') return { row, fresh: false };
      if (row.status !== 'PENDING') return { row, fresh: false, blocked: true };
      const withTx = await tx.subscription.update({
        where: { id },
        data: {
          providerTxId: txId,
          paidAt: new Date(),
          decidedAt: new Date(),
          providerMeta: { ...((row.providerMeta as object | null) ?? {}), ...(meta ?? {}) } as Prisma.InputJsonValue,
        },
      });
      const activated = await this.activate(tx, withTx);
      await tx.auditLog.create({ data: { actorId: null, action: 'SUBSCRIPTION_PAID', targetType: 'Subscription', targetId: id, after: { method: row.method, txId, userId: row.userId, plan: row.planCode, months: row.months } } });
      return { row: activated, fresh: true };
    });
    if (result.fresh) await this.notifyUser(result.row.userId, 'subscription.activated', 'Obuna faollashtirildi', `${planByCode(result.row.planCode)?.name ?? ''} obunangiz ${result.row.months} oyga faollashtirildi. To‘lov uchun rahmat!`);
    return result;
  }

  /** To‘lov bekor qilindi/muvaffaqiyatsiz (hali faollashmagan so‘rov yopiladi). */
  async gatewayFail(id: string, reason: string) {
    await this.db.subscription.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELED', note: reason } });
  }

  /** Payme: to‘lov yakunlangach qaytarilsa (CancelTransaction) — obuna bekor qilinadi. */
  async gatewayRefunded(id: string, reason: string) {
    const row = await this.db.subscription.findUnique({ where: { id } });
    if (!row || (row.status !== 'ACTIVE' && row.status !== 'EXPIRED')) return;
    await this.db.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id }, data: { status: 'CANCELED', endsAt: new Date(), note: reason } });
      await this.syncMasterPro(tx, row.userId);
      await tx.auditLog.create({ data: { actorId: null, action: 'SUBSCRIPTION_REFUNDED', targetType: 'Subscription', targetId: id, reason } });
    });
    await this.notifyUser(row.userId, 'subscription.expired', 'Obuna bekor qilindi', 'To‘lov qaytarilgani sababli obunangiz bekor qilindi.');
  }

  /** Umumiy webhook (Uzum): imzolangan hodisa natijasi bo‘yicha. */
  async gatewayWebhook(provider: 'UZUM' | 'CLICK' | 'PAYME', input: { subscriptionId: string; status: 'SUCCEEDED' | 'FAILED'; amount: number; currency: string; providerPaymentId?: string; failureReason?: string }) {
    const row = await this.gatewayFind(input.subscriptionId, provider);
    if (!row) return { found: false as const };
    if (Number(row.amount) !== input.amount || row.currency !== input.currency) return { found: true as const, mismatch: true as const };
    if (input.status === 'SUCCEEDED') await this.gatewayPaid(row.id, input.providerPaymentId ?? `${provider}-${row.id}`);
    else await this.gatewayFail(row.id, input.failureReason ?? `${provider}: to‘lov bajarilmadi`);
    return { found: true as const, mismatch: false as const };
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
      // To‘lanmagan eskirgan so‘rovlar: onlayn to‘lov 24 soatdan, chek yuklanmagan karta so‘rovi 3 kundan keyin yopiladi.
      await this.db.subscription.updateMany({ where: { status: 'PENDING', method: { in: ['CLICK', 'PAYME', 'UZUM'] }, createdAt: { lt: new Date(now.getTime() - 86_400_000) } }, data: { status: 'CANCELED', note: 'To‘lov amalga oshmadi' } });
      await this.db.subscription.updateMany({ where: { status: 'PENDING', method: 'CARD', receiptAssetId: null, createdAt: { lt: new Date(now.getTime() - 3 * 86_400_000) } }, data: { status: 'CANCELED', note: 'Chek yuklanmadi' } });
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
