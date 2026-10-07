import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { OutboxEvent } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { toNotificationTarget } from '../outbox/outbox-notification-map';
import { MediaProcessingService } from '../media/media-processing.service';
import { ClassificationService } from '../../modules/classification/classification.service';
import { MatchingService } from '../../modules/matching/matching.service';
import { BULLMQ_CONNECTION, OUTBOX_QUEUE_NAME } from './queue.constants';

interface OutboxJobData {
  eventId: string;
}

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private worker!: Worker<OutboxJobData>;

  constructor(
    @Inject(BULLMQ_CONNECTION) private readonly connection: Redis,
    private readonly db: PrismaService,
    private readonly mediaProcessing: MediaProcessingService,
    private readonly classification: ClassificationService,
    private readonly matching: MatchingService,
  ) {}

  onModuleInit() {
    this.worker = new Worker<OutboxJobData>(
      OUTBOX_QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection, concurrency: 5 },
    );

    this.worker.on('failed', (job, err) => {
      this.onFailed(job, err).catch((markError: Error) =>
        this.logger.error(`Dead-letter holatini saqlab bo‘lmadi: ${markError.message}`),
      );
    });
    this.worker.on('error', (err) => this.logger.error(`Worker xatoligi: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<OutboxJobData>): Promise<void> {
    const event = await this.db.outboxEvent.findUnique({ where: { id: job.data.eventId } });
    if (!event) {
      this.logger.warn(`${job.data.eventId} outbox hodisasi endi mavjud emas, o‘tkazib yuborildi`);
      return;
    }
    if (event.status === 'PUBLISHED') {
      return;
    }

    if (event.eventName.startsWith('media.')) {
      await this.processMediaEvent(event);
      return;
    }
    if (event.eventName === 'classification.requested') {
      await this.processClassificationRequested(event);
      return;
    }
    if (event.eventName === 'matching.requested') {
      const payload = event.payload as { requestId: string };
      await this.matching.runMatching(payload.requestId, { notBefore: event.createdAt });
      await this.db.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
      });
      return;
    }
    if (event.eventName === 'matching.wave') {
      await this.processMatchingWave(event);
      return;
    }

    if (event.eventName === 'notification.deliver') {
      await this.deliverNotification(event);
      return;
    }

    const target = toNotificationTarget(event);

    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${event.id}))`;
      const fresh = await tx.outboxEvent.findUnique({ where: { id: event.id }, select: { status: true } });
      if (fresh?.status === 'PUBLISHED') return;
      if (target) {
        const existing = await tx.notification.findFirst({
          where: { data: { path: ['outboxEventId'], equals: event.id } },
        });
        if (!existing) {
          await tx.notification.create({
            data: {
              userId: target.userId,
              channel: 'IN_APP',
              title: target.title,
              body: target.body,
              template: event.eventName,
              data: {
                outboxEventId: event.id,
                // Bildirishnoma bosilganda kerakli sahifaga o‘tish uchun.
                ...(typeof (event.payload as Record<string, unknown>)?.orderId === 'string' ? { orderId: (event.payload as Record<string, unknown>).orderId as string } : {}),
                // Buyurtma holati o‘zgarganda ro‘yxatda mos ikona ko‘rsatish uchun.
                ...(typeof (event.payload as Record<string, unknown>)?.newStatus === 'string' ? { status: (event.payload as Record<string, unknown>).newStatus as string } : {}),
              },
              status: 'SENT',
              sentAt: new Date(),
            },
          });
        }
      }

      await tx.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
      });
    });
  }

  private async deliverNotification(event: OutboxEvent): Promise<void> {
    const payload = event.payload as { notificationId: string; channel: string };
    if (payload.channel === 'IN_APP') {
      await this.db.notification.updateMany({
        where: { id: payload.notificationId, status: 'PENDING' },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } else {
      this.logger.warn(`${payload.channel} kanali uchun transport yo‘q; ${payload.notificationId} bildirishnomasi PENDING holatida qoladi`);
    }
    await this.db.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  private async processMediaEvent(event: OutboxEvent): Promise<void> {
    const payload = event.payload as { mediaAssetId: string };
    await this.mediaProcessing.process(payload.mediaAssetId);
    await this.db.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  private async processClassificationRequested(event: OutboxEvent): Promise<void> {
    const payload = event.payload as { requestId: string };
    await this.classification.classify(payload.requestId);
    await this.matching.runMatching(payload.requestId);
    await this.db.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  private async processMatchingWave(event: OutboxEvent): Promise<void> {
    const payload = event.payload as { requestId: string; runId: string; wave: number };
    await this.matching.notifyWave(payload.requestId, payload.runId, payload.wave);
    await this.db.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  private async onFailed(job: Job<OutboxJobData> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    this.logger.warn(
      `Outbox vazifasi bajarilmadi [hodisa=${job.data.eventId}] urinish ${job.attemptsMade}/${maxAttempts}: ${err.message}`,
    );

    if (job.attemptsMade >= maxAttempts) {
      const event = await this.db.outboxEvent.update({
        where: { id: job.data.eventId },
        data: { status: 'FAILED', attempts: job.attemptsMade, lastError: err.message },
      });
      if (event.eventName.startsWith('media.')) {
        const payload = event.payload as { mediaAssetId: string };
        await this.mediaProcessing.markPermanentlyFailed(payload.mediaAssetId, err.message, job.attemptsMade);
      }
      this.logger.error(`${job.data.eventId} outbox hodisasi butunlay muvaffaqiyatsiz tugadi (dead-letter)`);
    }
  }
}
