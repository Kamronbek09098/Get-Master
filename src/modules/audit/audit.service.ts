import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { cursorArgs, dateRangeWhere, toCursorPage } from '../../common/utils/cursor';
import { ActorRole, AuditQueryDto } from './dto/audit-query.dto';

const PERSON = { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } as const;

@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Bajaruvchi turi: admin roli bor bo‘lsa — admin; aks holda usta roli bor bo‘lsa — usta; qolganlari — mijoz.
   * Bajaruvchisi yo‘q yozuvlar — tizim.
   */
  private roleWhere(role: ActorRole): Prisma.AuditLogWhereInput {
    const admin = { userRoles: { some: { role: Role.ADMIN } } };
    const master = { userRoles: { some: { role: Role.MASTER } } };
    switch (role) {
      case 'SYSTEM':
        return { actorId: null };
      case 'ADMIN':
        return { actor: { is: admin } };
      case 'MASTER':
        return { actor: { is: { AND: [master, { NOT: admin }] } } };
      default:
        return { actor: { is: { AND: [{ NOT: admin }, { NOT: master }] } } };
    }
  }

  private baseWhere(query: AuditQueryDto): Prisma.AuditLogWhereInput {
    const search = query.search?.trim();
    return {
      actorId: query.actorId,
      ...(query.actorNumber ? { actor: { is: { accountNumber: query.actorNumber } } } : {}),
      targetType: query.targetType,
      targetId: query.targetId,
      createdAt: dateRangeWhere(query),
      AND: [
        ...(query.action ? [{ action: query.action }] : []),
        ...(query.category ? [{ action: { startsWith: query.category } }] : []),
        ...(search
          ? [{ OR: [{ action: { contains: search, mode: 'insensitive' as const } }, { reason: { contains: search, mode: 'insensitive' as const } }] }]
          : []),
      ],
    };
  }

  async findAll(query: AuditQueryDto) {
    const base = this.baseWhere(query);
    const where: Prisma.AuditLogWhereInput = query.actorRole ? { AND: [base, this.roleWhere(query.actorRole)] } : base;
    const rows = await this.db.auditLog.findMany({
      where,
      include: { actor: { select: { ...PERSON, userRoles: { select: { role: true } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    const withRole = page.items.map(({ actor, ...log }) => {
      const roles = actor?.userRoles.map((item) => item.role) ?? [];
      const actorRole: ActorRole = !actor ? 'SYSTEM' : roles.includes(Role.ADMIN) ? 'ADMIN' : roles.includes(Role.MASTER) ? 'MASTER' : 'CUSTOMER';
      return { ...log, actor: actor ? { id: actor.id, accountNumber: actor.accountNumber, firstName: actor.firstName, lastName: actor.lastName, phone: actor.phone } : null, actorRole };
    });
    return { ...page, items: await this.withTargetUsers(withRole) };
  }

  /** Bajaruvchi turlari bo‘yicha yozuvlar soni (boshqa filtrlar hisobga olinadi, bajaruvchi turidan tashqari). */
  async summary(query: AuditQueryDto) {
    const base = this.baseWhere(query);
    const roles: ActorRole[] = ['ADMIN', 'MASTER', 'CUSTOMER', 'SYSTEM'];
    const counts = await Promise.all(roles.map((role) => this.db.auditLog.count({ where: { AND: [base, this.roleWhere(role)] } })));
    const byRole = Object.fromEntries(roles.map((role, index) => [role, counts[index]!]));
    return { ...byRole, ALL: counts.reduce((sum, value) => sum + value, 0) };
  }

  /** Amal kimga qarshi bajarilganini (foydalanuvchi yoki usta hujjati egasi) ko‘rsatish uchun. */
  private async withTargetUsers<T extends { targetType: string | null; targetId: string | null }>(items: T[]) {
    const userIds = new Set<string>();
    const verificationIds = new Set<string>();
    const profileIds = new Set<string>();
    for (const item of items) {
      if (!item.targetId) continue;
      if (item.targetType === 'User') userIds.add(item.targetId);
      else if (item.targetType === 'MasterVerification') verificationIds.add(item.targetId);
      else if (item.targetType === 'MasterProfile') profileIds.add(item.targetId);
    }
    const [verifications, profiles] = await Promise.all([
      this.db.masterVerification.findMany({
        where: { id: { in: [...verificationIds] } },
        select: { id: true, documentType: true, master: { select: { userId: true } } },
      }),
      this.db.masterProfile.findMany({ where: { id: { in: [...profileIds] } }, select: { id: true, userId: true } }),
    ]);
    const userOfVerification = new Map(verifications.map((v) => [v.id, v.master.userId]));
    const userOfProfile = new Map(profiles.map((p) => [p.id, p.userId]));
    for (const id of userOfVerification.values()) userIds.add(id);
    for (const id of userOfProfile.values()) userIds.add(id);
    const users = userIds.size ? await this.db.user.findMany({ where: { id: { in: [...userIds] } }, select: PERSON }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const documentType = new Map(verifications.map((v) => [v.id, v.documentType]));

    return items.map((item) => {
      const userId =
        item.targetType === 'User'
          ? item.targetId
          : item.targetType === 'MasterVerification'
            ? userOfVerification.get(item.targetId ?? '')
            : item.targetType === 'MasterProfile'
              ? userOfProfile.get(item.targetId ?? '')
              : undefined;
      return {
        ...item,
        targetUser: (userId && byId.get(userId)) || null,
        targetDocumentType: item.targetType === 'MasterVerification' ? (documentType.get(item.targetId ?? '') ?? null) : null,
      };
    });
  }
}
