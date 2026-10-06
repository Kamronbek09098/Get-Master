import { createHash } from 'node:crypto';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { authCookieNames, panelOf } from '../../common/utils/panel';
import { verifyJwt, type AccessClaims } from '../../common/types/auth.types';
import type { ErrorNotifier } from '../../common/filters/all-exceptions.filter';
import type { ClientErrorDto } from './dto/client-error.dto';
import type { ErrorGroupsQueryDto, ErrorListQueryDto } from './dto/error-query.dto';

const RETENTION_DAYS = 30;

export interface ErrorRecord {
  source: 'SERVER' | 'CLIENT';
  kind: string;
  status?: number | null;
  code?: string | null;
  message: string;
  stack?: string | null;
  method?: string | null;
  path?: string | null;
  pageUrl?: string | null;
  requestId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  panel?: string | null;
  platform?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  appVersion?: string | null;
  context?: Prisma.InputJsonValue | null;
}

const cut = (value: string | null | undefined, max: number): string | null => (value ? value.slice(0, max) : null);
/** Query qismi (token, qidiruv matni) saqlanmaydi; UUID va raqamlar shablonga keltiriladi. */
const stripQuery = (value: string | null | undefined): string | null => (value ? value.split('?')[0].split('#')[0].slice(0, 500) : null);
const template = (path: string | null): string =>
  (path ?? '').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').replace(/\/\d+(?=\/|$)/g, '/:n');

/** Status yo‘q: interfeys xatosi yoki tarmoq (eski yozuvlarda 0). */
const NO_STATUS: Prisma.ErrorLogWhereInput = { OR: [{ status: null }, { status: 0 }] };

function statusClassWhere(statusClass?: '4xx' | '5xx' | 'none'): Prisma.ErrorLogWhereInput | null {
  if (statusClass === '4xx') return { status: { gte: 400, lt: 500 } };
  if (statusClass === '5xx') return { status: { gte: 500, lt: 600 } };
  if (statusClass === 'none') return NO_STATUS;
  return null;
}

@Injectable()
export class ErrorLogService implements ErrorNotifier {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Xatolikni bazaga yozadi. Hech qachon asosiy so‘rovni buzmaydi (xatolik ichida xatolik chiqmasin). */
  async record(input: ErrorRecord): Promise<void> {
    try {
      const path = stripQuery(input.path);
      const severity = input.kind === 'UI_CRASH' || input.kind === 'UNHANDLED' || !input.status || input.status >= 500 ? 'ERROR' : 'WARNING';
      const fingerprint = createHash('sha1')
        .update([input.source, input.kind, input.code ?? '', input.status ?? '', input.method ?? '', template(path), (input.message ?? '').split('\n')[0].slice(0, 120)].join('|'))
        .digest('hex');
      await this.db.errorLog.create({
        data: {
          source: input.source,
          kind: input.kind.slice(0, 32),
          severity,
          status: input.status || null,
          code: cut(input.code, 100),
          message: cut(input.message, 2000) ?? '',
          stack: cut(input.stack, 8000),
          method: cut(input.method, 10),
          path,
          pageUrl: stripQuery(input.pageUrl),
          requestId: cut(input.requestId, 100),
          userId: input.userId ?? null,
          userRole: cut(input.userRole, 20),
          panel: cut(input.panel, 20),
          platform: cut(input.platform, 20),
          userAgent: cut(input.userAgent, 400),
          ipAddress: cut(input.ipAddress, 64),
          appVersion: cut(input.appVersion, 40),
          context: input.context ?? undefined,
          fingerprint,
        },
      });
    } catch (error) {
      this.logger.warn(`Xatolikni yozib bo‘lmadi: ${(error as Error).message}`);
    }
  }

  /** AllExceptionsFilter uchun: server tomonidagi har bir xatolik shu yerga tushadi. */
  notifyError(alert: { status: number; code: string; message: string; method?: string; path?: string; requestId?: string | null; stack?: string; req?: Request; details?: string[] }): void {
    const req = alert.req;
    const actor = req ? this.actorOf(req) : null;
    void this.record({
      source: 'SERVER',
      kind: alert.code === 'UNHANDLED_REJECTION' || alert.code === 'UNCAUGHT_EXCEPTION' ? 'UNHANDLED' : 'HTTP',
      status: alert.status,
      code: alert.code,
      message: alert.message,
      stack: alert.stack,
      method: alert.method,
      path: alert.path,
      requestId: alert.requestId,
      userId: actor?.userId,
      userRole: actor?.role,
      panel: req ? panelOf(req) : null,
      platform: req ? this.platformOf(req) : null,
      userAgent: req?.headers?.['user-agent']?.toString(),
      ipAddress: req ? this.ipOf(req) : null,
      context: alert.details?.length ? { details: alert.details.slice(0, 20) } : null,
    });
  }

  async recordClient(dto: ClientErrorDto, req: Request): Promise<void> {
    const actor = this.actorOf(req);
    await this.record({
      source: 'CLIENT',
      kind: dto.kind,
      status: dto.status,
      code: dto.code,
      message: dto.message,
      stack: dto.stack,
      method: dto.method,
      path: dto.path,
      pageUrl: dto.pageUrl,
      requestId: dto.requestId,
      userId: actor?.userId,
      userRole: actor?.role,
      panel: panelOf(req),
      platform: dto.platform ?? this.platformOf(req),
      userAgent: req.headers['user-agent']?.toString(),
      ipAddress: this.ipOf(req),
      appVersion: dto.appVersion,
      context: dto.context as Prisma.InputJsonValue | undefined,
    });
  }

  // ---- Superadmin uchun o‘qish ----

  async assertSuperAdmin(userId: string): Promise<void> {
    const actor = await this.db.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
    if (!actor?.isSuperAdmin) throw new ForbiddenException(ERRORS.FORBIDDEN);
  }

  private where(query: ErrorListQueryDto): Prisma.ErrorLogWhereInput {
    const and: Prisma.ErrorLogWhereInput[] = [];
    if (query.source) and.push({ source: query.source });
    if (query.severity) and.push({ severity: query.severity });
    if (query.kind) and.push({ kind: query.kind });
    if (query.panel) and.push({ panel: query.panel });
    if (query.platform) and.push({ platform: query.platform });
    if (query.status === 0) and.push(NO_STATUS);
    else if (query.status) and.push({ status: query.status });
    const byClass = statusClassWhere(query.statusClass);
    if (byClass) and.push(byClass);
    if (query.fingerprint) and.push({ fingerprint: query.fingerprint });
    if (query.state === 'open') and.push({ resolvedAt: null });
    if (query.state === 'resolved') and.push({ resolvedAt: { not: null } });
    if (query.accountNumber) and.push({ user: { accountNumber: query.accountNumber } });
    if (query.from || query.to) and.push({ createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } });
    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [
          { message: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { path: { contains: q, mode: 'insensitive' } },
          { requestId: { equals: q } },
        ],
      });
    }
    return and.length ? { AND: and } : {};
  }

  async list(query: ErrorListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.db.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } } },
      }),
      this.db.errorLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async summary() {
    const now = Date.now();
    const since24 = new Date(now - 24 * 3600_000);
    const since7d = new Date(now - 7 * 24 * 3600_000);
    const [last24, last24Errors, openTotal, bySource, byKind, byStatus, affected, daily] = await Promise.all([
      this.db.errorLog.count({ where: { createdAt: { gte: since24 } } }),
      this.db.errorLog.count({ where: { createdAt: { gte: since24 }, severity: 'ERROR' } }),
      this.db.errorLog.count({ where: { resolvedAt: null } }),
      this.db.errorLog.groupBy({ by: ['source'], where: { createdAt: { gte: since7d } }, _count: { _all: true } }),
      this.db.errorLog.groupBy({ by: ['kind'], where: { createdAt: { gte: since7d } }, _count: { _all: true } }),
      this.db.errorLog.groupBy({ by: ['status'], where: { createdAt: { gte: since7d }, resolvedAt: null }, _count: { _all: true }, _max: { createdAt: true } }),
      this.db.errorLog.findMany({ where: { createdAt: { gte: since24 }, userId: { not: null } }, distinct: ['userId'], select: { userId: true } }),
      this.db.$queryRaw<{ day: Date; total: bigint; errors: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS total, COUNT(*) FILTER (WHERE severity = 'ERROR') AS errors
        FROM error_logs WHERE "createdAt" >= ${since7d} GROUP BY 1 ORDER BY 1`,
    ]);
    return {
      last24h: last24,
      last24hErrors: last24Errors,
      openTotal,
      affectedUsers24h: affected.length,
      bySource: bySource.map((row) => ({ source: row.source, count: row._count._all })),
      byKind: byKind.map((row) => ({ kind: row.kind, count: row._count._all })),
      byStatus: this.mergeStatuses(byStatus),
      daily: daily.map((row) => ({ day: row.day, total: Number(row.total), errors: Number(row.errors) })),
    };
  }

  private mergeStatuses(rows: { status: number | null; _count: { _all: number }; _max: { createdAt: Date | null } }[]) {
    const merged = new Map<number, { status: number; count: number; lastSeenAt: Date | null }>();
    for (const row of rows) {
      const key = row.status ?? 0;
      const prev = merged.get(key);
      const last = row._max.createdAt;
      merged.set(key, { status: key, count: (prev?.count ?? 0) + row._count._all, lastSeenAt: prev?.lastSeenAt && last && prev.lastSeenAt > last ? prev.lastSeenAt : last });
    }
    return [...merged.values()].sort((a, b) => a.status - b.status);
  }

  async groups(query: ErrorGroupsQueryDto) {
    const days = query.days ?? 7;
    const since = new Date(Date.now() - days * 24 * 3600_000);
    const filters: Prisma.Sql[] = [Prisma.sql`"createdAt" >= ${since}`];
    if (query.source) filters.push(Prisma.sql`source = ${query.source}`);
    if (query.status === 0) filters.push(Prisma.sql`(status IS NULL OR status = 0)`);
    else if (query.status) filters.push(Prisma.sql`status = ${query.status}`);
    if (query.statusClass === '4xx') filters.push(Prisma.sql`status BETWEEN 400 AND 499`);
    if (query.statusClass === '5xx') filters.push(Prisma.sql`status BETWEEN 500 AND 599`);
    if (query.statusClass === 'none') filters.push(Prisma.sql`(status IS NULL OR status = 0)`);
    const having =
      query.state === 'open'
        ? Prisma.sql`HAVING COUNT(*) FILTER (WHERE resolved_at IS NULL) > 0`
        : query.state === 'resolved'
          ? Prisma.sql`HAVING COUNT(*) FILTER (WHERE resolved_at IS NULL) = 0`
          : Prisma.empty;
    const rows = await this.db.$queryRaw<
      { fingerprint: string; total: bigint; users: bigint; last_seen: Date; first_seen: Date; open: bigint }[]
    >`
      SELECT fingerprint, COUNT(*) AS total, COUNT(DISTINCT user_id) AS users, MAX("createdAt") AS last_seen, MIN("createdAt") AS first_seen,
             COUNT(*) FILTER (WHERE resolved_at IS NULL) AS open
      FROM error_logs WHERE ${Prisma.join(filters, ' AND ')}
      GROUP BY fingerprint ${having} ORDER BY MAX("createdAt") DESC LIMIT 100`;
    if (rows.length === 0) return [];
    const samples = await this.db.errorLog.findMany({
      where: { fingerprint: { in: rows.map((row) => row.fingerprint) } },
      orderBy: { createdAt: 'desc' },
      distinct: ['fingerprint'],
      select: { fingerprint: true, source: true, kind: true, severity: true, status: true, code: true, message: true, method: true, path: true, pageUrl: true },
    });
    const sample = new Map(samples.map((item) => [item.fingerprint, item]));
    return rows.map((row) => ({
      ...sample.get(row.fingerprint),
      fingerprint: row.fingerprint,
      count: Number(row.total),
      users: Number(row.users),
      openCount: Number(row.open),
      firstSeenAt: row.first_seen,
      lastSeenAt: row.last_seen,
    }));
  }

  async resolve(input: { ids?: string[]; fingerprint?: string }, value: boolean) {
    const where: Prisma.ErrorLogWhereInput = input.fingerprint ? { fingerprint: input.fingerprint } : { id: { in: input.ids ?? [] } };
    const result = await this.db.errorLog.updateMany({ where, data: { resolvedAt: value ? new Date() : null } });
    return { updated: result.count };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    try {
      const result = await this.db.errorLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * 3600_000) } } });
      if (result.count) this.logger.log(`Eski xatolik yozuvlari o‘chirildi: ${result.count}`);
    } catch (error) {
      this.logger.warn(`Tozalash bajarilmadi: ${(error as Error).message}`);
    }
  }

  // ---- yordamchilar ----

  private ipOf(req: Request): string | null {
    return (req.ip ?? req.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ?? null) || null;
  }

  private platformOf(req: Request): string {
    const ua = req.headers?.['user-agent']?.toString() ?? '';
    if (/Android/i.test(ua) && /wv|Capacitor|GetMaster/i.test(ua)) return 'android';
    if (/iPhone|iPad/i.test(ua) && /Capacitor|GetMaster/i.test(ua)) return 'ios';
    return 'web';
  }

  /** Public yo‘llarda `req.user` bo‘lmaydi: kirgan foydalanuvchi bo‘lsa, access cookie’dan aniqlanadi. */
  private actorOf(req: Request): { userId: string; role: string | null } | null {
    const fromGuard = (req as unknown as { user?: { sub?: string; roles?: string[] } }).user;
    if (fromGuard?.sub) return { userId: fromGuard.sub, role: this.roleOf(fromGuard.roles, req) };
    try {
      const name = authCookieNames(panelOf(req)).access;
      const cookie = req.headers?.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
      const token = cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
      if (!token) return null;
      const claims = verifyJwt<AccessClaims>(token, this.config.getOrThrow<string>('auth.jwtSecret'), 'access');
      return { userId: claims.sub, role: this.roleOf(claims.roles, req) };
    } catch {
      return null;
    }
  }

  private roleOf(roles: string[] | undefined, req: Request): string | null {
    const panel = panelOf(req);
    if (panel && roles?.includes(panel)) return panel;
    return roles?.[0] ?? null;
  }
}
