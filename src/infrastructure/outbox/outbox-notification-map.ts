import { OutboxEvent } from '@prisma/client';

export type NotificationTarget = { userId: string; title: string; body: string } | null;

export function toNotificationTarget(event: OutboxEvent): NotificationTarget {
  const payload = event.payload as Record<string, unknown>;
  switch (event.eventName) {
    case 'order.booked':
      return {
        userId: payload.masterUserId as string,
        title: 'Yangi buyurtma',
        body: "Sizning taklifingiz qabul qilindi, buyurtma yaratildi.",
      };
    case 'order.status_changed':
      return {
        userId: payload.notifyUserId as string,
        title: "Buyurtma holati o'zgardi",
        body: `Buyurtma holati: ${payload.oldStatus} -> ${payload.newStatus}.`,
      };
    case 'payment.succeeded':
      return {
        userId: payload.customerId as string,
        title: "To'lov muvaffaqiyatli",
        body: "To'lovingiz muvaffaqiyatli qabul qilindi.",
      };
    case 'payment.failed':
      return {
        userId: payload.customerId as string,
        title: "To'lov amalga oshmadi",
        body: "To'lovingiz amalga oshmadi, qaytadan urinib ko'ring.",
      };
    default:
      return null;
  }
}
