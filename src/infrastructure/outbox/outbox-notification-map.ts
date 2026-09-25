import { OutboxEvent } from '@prisma/client';

/**
 * Buyurtma holati o‘zgarganda kimga nima deyilishi: «kim nima qildi» ko‘rinishida, joriy holatni aytadi.
 * Kalit: oluvchi (MIJOZ yoki USTA) + yangi holat + (kerak bo‘lsa) amalni bajargan tomon.
 */
type OrderMessage = { title: string; body: string };

function orderMessage(newStatus: string, actorType: string, recipientIsCustomer: boolean): OrderMessage {
  if (recipientIsCustomer) {
    switch (newStatus) {
      case 'CONFIRMED':
        return { title: 'Usta buyurtmani tasdiqladi', body: 'Usta buyurtmangizni qabul qildi va tasdiqladi.' };
      case 'ON_THE_WAY':
        return { title: 'Usta yo‘lga chiqdi', body: 'Usta sizning manzilingizga qarab yo‘lda.' };
      case 'ARRIVED':
        return { title: 'Usta yetib keldi', body: 'Usta manzilingizga yetib keldi.' };
      case 'IN_PROGRESS':
        return { title: 'Usta ishni boshladi', body: 'Buyurtmangiz bo‘yicha ish boshlandi.' };
      case 'WAITING_CONFIRMATION':
        return { title: 'Usta ishni tugatdi', body: 'Ish bajarildi. Iltimos, natijani ko‘rib chiqib, tasdiqlang.' };
      case 'COMPLETED':
        return actorType === 'SYSTEM'
          ? { title: 'Buyurtma avtomatik yakunlandi', body: 'Tasdiqlash muddati tugagani uchun buyurtma yakunlandi.' }
          : { title: 'Buyurtma yakunlandi', body: 'Nizo ko‘rib chiqilib, buyurtma administrator tomonidan yakunlandi.' };
      case 'CANCELLED':
        return actorType === 'ADMIN'
          ? { title: 'Buyurtma bekor qilindi', body: 'Buyurtma administrator tomonidan bekor qilindi.' }
          : { title: 'Usta buyurtmani bekor qildi', body: 'Afsuski, usta buyurtmani bekor qildi.' };
      case 'EXPIRED':
        return { title: 'Buyurtma muddati tugadi', body: 'Usta belgilangan vaqtda tasdiqlamagani uchun buyurtma bekor bo‘ldi.' };
      case 'DISPUTED':
        return { title: 'Usta nizo ochdi', body: 'Buyurtma bo‘yicha nizo ochildi. Administrator ko‘rib chiqadi.' };
    }
  } else {
    switch (newStatus) {
      case 'COMPLETED':
        return { title: 'Mijoz ishni tasdiqladi', body: 'Buyurtma muvaffaqiyatli yakunlandi.' };
      case 'CANCELLED':
        return { title: 'Mijoz buyurtmani bekor qildi', body: 'Mijoz buyurtmani bekor qildi.' };
      case 'DISPUTED':
        return { title: 'Mijoz nizo ochdi', body: 'Buyurtma bo‘yicha nizo ochildi. Administrator ko‘rib chiqadi.' };
    }
  }
  return { title: 'Buyurtma yangilandi', body: 'Buyurtmangiz holati yangilandi. Tafsilotlarni buyurtma sahifasida ko‘ring.' };
}

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
    case 'order.status_changed': {
      const message = orderMessage(String(payload.newStatus), String(payload.actorType ?? ''), payload.actorType !== 'CUSTOMER');
      return { userId: payload.notifyUserId as string, ...message };
    }
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
