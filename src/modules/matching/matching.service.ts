import { Injectable, Logger } from '@nestjs/common';
import { MasterProfile, Prisma } from '@prisma/client';
import { MasterStatsService } from '../master/master-stats.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { fitsSchedule, type ScheduleWindow } from '../../common/utils/schedule';
import { PushService } from '../push/push.service';

const ALGORITHM_VERSION = 'v1.0';

const WEIGHTS = {
  relevance: 0.25,
  distance: 0.2,
  availability: 0.1,
  rating: 0.2,
  completion: 0.15,
  response: 0.1,
  cancellationPenalty: 0.15,
} as const;

const WAVE_SIZE = 5;
const MAX_WAVES = 3;
const WAVE_DELAY_MS = 5 * 60_000;
const EARTH_RADIUS_KM = 6371;
const NEUTRAL_RATE = 0.5;
const AT_MASTER_FAR_KM = 30;

const OFFER_ELIGIBLE_STATUSES = ['SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'];

type AvailabilityWindow = ScheduleWindow;

interface ScoredCandidate {
  master: MasterProfile;
  score: number;
  distanceKm: number | null;
  reason: Record<string, number>;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly masterStats: MasterStatsService,
    private readonly push: PushService,
  ) {}

  async runMatching(requestId: string, opts: { notBefore?: Date } = {}): Promise<void> {
    const request = await this.db.problemRequest.findUnique({ where: { id: requestId } });
    if (!request || !OFFER_ELIGIBLE_STATUSES.includes(request.status)) return;
    if (!request.serviceId) {
      this.logger.log(`${requestId} so‘rovi uchun xizmat hali aniqlanmagan, moslashtirish o‘tkazib yuborildi`);
      return;
    }

    const run = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM problem_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
      const alreadyMatched = await tx.matchingRun.findFirst({
        where: {
          requestId,
          status: { in: ['PENDING', 'RUNNING', 'COMPLETED'] },
          ...(opts.notBefore ? { createdAt: { gte: opts.notBefore } } : {}),
        },
      });
      if (alreadyMatched) return null;
      return tx.matchingRun.create({
        data: { requestId, status: 'RUNNING', algorithmVersion: ALGORITHM_VERSION, startedAt: new Date() },
      });
    });
    if (!run) return;

    try {
      const candidates = await this.findEligibleMasters(request.serviceId, request.customerId, request.serviceMode);
      const relevance = await this.resolveRelevance(requestId, request.serviceId);
      const history = await this.loadHistory(candidates.map((c) => c.id));
      const scored = this.score(candidates, request, relevance, history, request.serviceMode);

      if (scored.length > 0) {
        await this.db.matchingResult.createMany({
          data: scored.map((c) => ({
            runId: run.id,
            masterId: c.master.id,
            score: c.score,
            distanceKm: c.distanceKm ?? undefined,
            reason: c.reason as Prisma.InputJsonValue,
          })),
        });
      }

      await this.db.matchingRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await this.db.problemRequest.updateMany({ where: { id: requestId, status: 'SUBMITTED' }, data: { status: 'MATCHING' } });

      await this.notifyWave(requestId, run.id, 1);
    } catch (error) {
      await this.db.matchingRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: (error as Error).message.slice(0, 500) },
      });
      throw error;
    }
  }

  async notifyWave(requestId: string, runId: string, wave: number): Promise<void> {
    const request = await this.db.problemRequest.findUnique({ where: { id: requestId } });
    if (!request || !OFFER_ELIGIBLE_STATUSES.includes(request.status)) return;
    if (request.expiresAt && request.expiresAt <= new Date()) return;

    const nextBatch = await this.db.matchingResult.findMany({
      where: { runId, status: 'CANDIDATE' },
      orderBy: { score: 'desc' },
      take: WAVE_SIZE,
    });
    if (nextBatch.length === 0) return;

    const notifiedUserIds: string[] = [];
    await this.db.$transaction(async (tx) => {
      for (const result of nextBatch) {
        const claimed = await tx.matchingResult.updateMany({
          where: { id: result.id, status: 'CANDIDATE' },
          data: { status: 'NOTIFIED' },
        });
        if (claimed.count === 0) continue;
        const master = await tx.masterProfile.findUniqueOrThrow({ where: { id: result.masterId } });
        await tx.notification.create({
          data: {
            userId: master.userId,
            channel: 'PUSH',
            title: 'Yangi so‘rov mos keldi',
            body: 'Sizga mos keladigan yangi mijoz so‘rovi bor. Ilovada ko‘rib, taklif yuboring.',
            template: 'matching.wave',
            data: { requestId, runId, wave } as Prisma.InputJsonValue,
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        notifiedUserIds.push(master.userId);
        await this.masterStats.recompute(master.id, tx);
      }
    });
    for (const userId of notifiedUserIds) {
      void this.push.sendToUser(userId, { title: 'Yangi so‘rov mos keldi', body: 'Sizga mos keladigan yangi mijoz so‘rovi bor. Ilovada ko‘rib, taklif yuboring.', data: { type: 'matching.wave', requestId } });
    }

    this.logger.log(`${requestId} so‘rovi uchun ${wave}-to‘lqinda ${nextBatch.length} ta ustaga xabar yuborildi`);

    if (wave < MAX_WAVES) {
      await this.db.outboxEvent.create({
        data: {
          eventName: 'matching.wave',
          aggregateType: 'ProblemRequest',
          aggregateId: requestId,
          payload: { requestId, runId, wave: wave + 1 } as Prisma.InputJsonValue,
          status: 'PENDING',
          availableAt: new Date(Date.now() + WAVE_DELAY_MS),
        },
      });
    }
  }

  private async loadHistory(masterIds: string[]): Promise<Map<string, { finishedOrders: number; notified: number }>> {
    const history = new Map<string, { finishedOrders: number; notified: number }>(
      masterIds.map((id) => [id, { finishedOrders: 0, notified: 0 }]),
    );
    const [orders, notified] = await Promise.all([
      this.db.order.groupBy({
        by: ['masterId'],
        where: { masterId: { in: masterIds }, status: { in: ['COMPLETED', 'CANCELLED', 'EXPIRED'] } },
        _count: { _all: true },
      }),
      this.db.matchingResult.groupBy({
        by: ['masterId'],
        where: { masterId: { in: masterIds }, status: { in: ['NOTIFIED', 'DECLINED', 'EXPIRED'] } },
        _count: { _all: true },
      }),
    ]);
    for (const row of orders) {
      const entry = history.get(row.masterId);
      if (entry) entry.finishedOrders = row._count._all;
    }
    for (const row of notified) {
      const entry = history.get(row.masterId);
      if (entry) entry.notified = row._count._all;
    }
    return history;
  }

  private async findEligibleMasters(serviceId: string, customerId: string, serviceMode: 'AT_CUSTOMER' | 'AT_MASTER'): Promise<Array<MasterProfile & { availability: AvailabilityWindow[] }>> {
    return this.db.masterProfile.findMany({
      where: {
        status: 'ACTIVE',
        isPaused: false,
        verification: 'VERIFIED',
        userId: { not: customerId },
        serviceModes: { has: serviceMode },
        services: { some: { serviceId, isActive: true, service: { isActive: true } } },
      },
      include: { availability: true },
    });
  }

  private async resolveRelevance(requestId: string, serviceId: string): Promise<number> {
    const latest = await this.db.aIClassification.findFirst({
      where: { requestId, serviceId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.confidence ? Number(latest.confidence) : 1;
  }

  private score(
    masters: Array<MasterProfile & { availability: AvailabilityWindow[] }>,
    request: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null },
    relevance: number,
    history: Map<string, { finishedOrders: number; notified: number }>,
    serviceMode: 'AT_CUSTOMER' | 'AT_MASTER' = 'AT_CUSTOMER',
  ): ScoredCandidate[] {
    const now = new Date();
    const results: ScoredCandidate[] = [];

    for (const master of masters) {
      let distanceKm: number | null = null;
      let distanceRatio = 0;
      if (request.latitude != null && request.longitude != null && master.latitude != null && master.longitude != null) {
        distanceKm = haversineKm(
          Number(request.latitude),
          Number(request.longitude),
          Number(master.latitude),
          Number(master.longitude),
        );
        if (serviceMode === 'AT_MASTER') {
          // Mijoz ustaning oldiga boradi: usta radiusi hisobga olinmaydi, yaqinroq joy afzal (30 km dan keyin eng past ball).
          distanceRatio = Math.min(1, distanceKm / AT_MASTER_FAR_KM);
        } else if (master.workRadiusKm != null && Number(master.workRadiusKm) > 0) {
          const dmax = Number(master.workRadiusKm);
          if (distanceKm > dmax) continue;
          distanceRatio = distanceKm / dmax;
        }
      }

      const availability = fitsSchedule(master.availability, now) ? 1 : 0;
      const rating = Number(master.ratingAvg) / 5;
      const past = history.get(master.id);
      const completion = past && past.finishedOrders > 0 ? Number(master.completionRate) / 100 : NEUTRAL_RATE;
      const response = past && past.notified > 0 ? Number(master.responseRate) / 100 : NEUTRAL_RATE;
      const cancellationPenalty = Number(master.cancellationRate) / 100;

      const score =
        WEIGHTS.relevance * relevance +
        WEIGHTS.distance * (1 - distanceRatio) +
        WEIGHTS.availability * availability +
        WEIGHTS.rating * rating +
        WEIGHTS.completion * completion +
        WEIGHTS.response * response -
        WEIGHTS.cancellationPenalty * cancellationPenalty;

      results.push({
        master,
        distanceKm,
        score: Math.round(score * 10_000) / 10_000,
        reason: { relevance, distanceRatio, availability, rating, completion, response, cancellationPenalty },
      });
    }

    return results.sort((a, b) => b.score - a.score || a.master.id.localeCompare(b.master.id));
  }
}
