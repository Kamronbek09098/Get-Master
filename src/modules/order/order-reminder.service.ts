import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';

const SWEEP_INTERVAL_MS = 5 * 60_000;
/** Belgilangan vaqtga shuncha qolganda eslatma yuboriladi. */
const REMINDER_WINDOW_MS = 60 * 60_000;
const REMINDABLE_STATUSES: OrderStatus[] = ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED'];

/** Buyurtma vaqti yaqinlashganda mijoz va ustaga bittadan eslatma yuboradi (har biri uchun faqat bir marta). */
@Injectable()
export class OrderReminderService {
  private readonly logger = new Logger(OrderReminderService.name);
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  @Interval(SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendUpcomingReminders();
    } catch (error) {
      this.logger.error(`Buyurtma eslatmalarini yuborishda xatolik: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async sendUpcomingReminders(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);
    const orders = await this.db.order.findMany({
      where: {
        status: { in: REMINDABLE_STATUSES },
        booking: { scheduledStartAt: { gt: now, lte: windowEnd }, reminderSentAt: null },
      },
      select: {
        id: true,
        customerId: true,
        bookingId: true,
        master: { select: { userId: true } },
        booking: { select: { scheduledStartAt: true } },
      },
      take: 200,
    });

    let sent = 0;
    for (const order of orders) {
      await this.db.$transaction(async (tx) => {
        const claimed = await tx.booking.updateMany({
          where: { id: order.bookingId, reminderSentAt: null },
          data: { reminderSentAt: new Date() },
        });
        if (claimed.count === 0) return;

        const scheduledStartAt = order.booking.scheduledStartAt!.toISOString();
        await this.outbox.emit(tx, {
          eventName: 'order.reminder',
          aggregateType: 'Order',
          aggregateId: order.id,
          payload: { orderId: order.id, notifyUserId: order.customerId, scheduledStartAt },
        });
        await this.outbox.emit(tx, {
          eventName: 'order.reminder',
          aggregateType: 'Order',
          aggregateId: order.id,
          payload: { orderId: order.id, notifyUserId: order.master.userId, scheduledStartAt },
        });
        sent += 1;
      });
    }
    if (sent > 0) this.logger.log(`${sent} ta buyurtma uchun vaqt eslatmasi yuborildi`);
  }
}
