import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface MasterStats {
  completedOrders: number;
  completionRate: number;
  responseRate: number;
  cancellationRate: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const percent = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

@Injectable()
export class MasterStatsService {
  constructor(private readonly db: PrismaService) {}

  async recompute(masterId: string, client?: Prisma.TransactionClient): Promise<MasterStats> {
    if (!client) return this.db.$transaction((tx) => this.recompute(masterId, tx));
    await client.$queryRaw`SELECT id FROM master_profiles WHERE id = ${masterId}::uuid FOR UPDATE`;

    const [orderRows, cancelRows, responseRows] = await Promise.all([
      client.$queryRaw<Array<{ total: bigint; completed: bigint; expired: bigint }>>`
        SELECT count(*) AS total,
               count(*) FILTER (WHERE status = 'COMPLETED') AS completed,
               count(*) FILTER (WHERE status = 'EXPIRED')   AS expired
        FROM orders WHERE "masterId" = ${masterId}::uuid`,
      client.$queryRaw<Array<{ cancelled: bigint }>>`
        SELECT count(DISTINCT o.id) AS cancelled
        FROM orders o
        JOIN order_status_history h ON h."orderId" = o.id
        WHERE o."masterId" = ${masterId}::uuid
          AND o.status = 'CANCELLED'
          AND h."newStatus" = 'CANCELLED'
          AND h."actorType" IN ('MASTER', 'ADMIN')`,
      client.$queryRaw<Array<{ notified: bigint; responded: bigint }>>`
        SELECT count(*) AS notified,
               count(*) FILTER (
                 WHERE mr.status = 'DECLINED'
                    OR EXISTS (SELECT 1 FROM offers f WHERE f."requestId" = run."requestId" AND f."masterId" = mr."masterId")
               ) AS responded
        FROM matching_results mr
        JOIN matching_runs run ON run.id = mr."runId"
        WHERE mr."masterId" = ${masterId}::uuid AND mr.status IN ('NOTIFIED', 'DECLINED', 'EXPIRED')`,
    ]);

    const total = Number(orderRows[0]?.total ?? 0);
    const completed = Number(orderRows[0]?.completed ?? 0);
    const expired = Number(orderRows[0]?.expired ?? 0);
    const masterCancelled = Number(cancelRows[0]?.cancelled ?? 0);
    const notified = Number(responseRows[0]?.notified ?? 0);
    const responded = Number(responseRows[0]?.responded ?? 0);

    const stats: MasterStats = {
      completedOrders: completed,
      completionRate: percent(completed, completed + masterCancelled + expired),
      cancellationRate: percent(masterCancelled, total),
      responseRate: percent(responded, notified),
    };

    await client.masterProfile.update({ where: { id: masterId }, data: stats });
    return stats;
  }
}
