import { OutboxEvent } from '@prisma/client';

/** Buyurtma holatlarining foydalanuvchi tushunadigan nomi va sarlavhasi. */
const ORDER_STATUS: Record<string, { label: string; title: string }> = {
  DRAFT: { label: 'Qoralama', title: 'Buyurtma qoralamaga o‘tdi' },
  SUBMITTED: { label: 'Yuborildi', title: 'Buyurtma yuborildi' },
  MATCHING: { label: 'Mos usta izlanmoqda', title: 'Mos usta izlanmoqda' },
  OFFERS_RECEIVED: { label: 'Takliflar keldi', title: 'Takliflar keldi' },
  BOOKED: { label: 'Band qilindi', title: 'Buyurtma band qilindi' },
  CONFIRMED: { label: 'Tasdiqlandi', title: 'Buyurtma tasdiqlandi' },
  ON_THE_WAY: { label: 'Usta yo‘lda', title: 'Usta yo‘lga chiqdi' },
  ARRIVED: { label: 'Usta yetib keldi', title: 'Usta yetib keldi' },
  IN_PROGRESS: { label: 'Ish jarayonida', title: 'Ish boshlandi' },
  WAITING_CONFIRMATION: { label: 'Tasdiq kutilmoqda', title: 'Ish tugadi, tasdiqingiz kutilmoqda' },
  COMPLETED: { label: 'Yakunlandi', title: 'Buyurtma yakunlandi' },
  CANCELLED: { label: 'Bekor qilindi', title: 'Buyurtma bekor qilindi' },
  EXPIRED: { label: 'Muddati tugadi', title: 'Buyurtma muddati tugadi' },
  DISPUTED: { label: 'Nizoli', title: 'Buyurtma bo‘yicha nizo ochildi' },
};
const statusLabel = (status: unknown) => ORDER_STATUS[String(status)]?.label ?? String(status);

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
        title: ORDER_STATUS[String(payload.newStatus)]?.title ?? "Buyurtma holati o'zgardi",
        body: `Buyurtma holati «${statusLabel(payload.oldStatus)}» dan «${statusLabel(payload.newStatus)}» ga o‘zgardi.`,
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
