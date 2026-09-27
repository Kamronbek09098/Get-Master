import { OutboxEvent } from '@prisma/client';
import { formatUzDateTime } from '../../common/utils/format-date';

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
        return actorType === 'ADMIN'
          ? { title: 'Buyurtma yakunlandi', body: 'Nizo ko‘rib chiqilib, buyurtma administrator tomonidan yakunlandi.' }
          : { title: 'Mijoz ishni tasdiqladi', body: 'Buyurtma muvaffaqiyatli yakunlandi.' };
      case 'CANCELLED':
        return actorType === 'ADMIN'
          ? { title: 'Buyurtma bekor qilindi', body: 'Buyurtma administrator tomonidan bekor qilindi.' }
          : { title: 'Mijoz buyurtmani bekor qildi', body: 'Mijoz buyurtmani bekor qildi.' };
      case 'DISPUTED':
        return { title: 'Mijoz nizo ochdi', body: 'Buyurtma bo‘yicha nizo ochildi. Administrator ko‘rib chiqadi.' };
    }
  }
  return { title: 'Buyurtma yangilandi', body: 'Buyurtmangiz holati yangilandi. Tafsilotlarni buyurtma sahifasida ko‘ring.' };
}

const PROVIDER: Record<string, string> = { CASH: 'naqd pul', CLICK: 'Click', PAYME: 'Payme', UZUM: 'Uzum', OTHER: 'boshqa usul' };
const money = (amount: unknown, currency: unknown) => `${Number(amount).toLocaleString('ru-RU')} ${String(currency ?? 'UZS')}`;

export type NotificationTarget = { userId: string; title: string; body: string } | null;

export function toNotificationTarget(event: OutboxEvent): NotificationTarget {
  const payload = event.payload as Record<string, unknown>;
  switch (event.eventName) {
    case 'order.booked':
      if (payload.direct) {
        return {
          userId: payload.masterUserId as string,
          title: 'Mijoz sizga buyurtma yubordi',
          body: `«${String(payload.title)}» — ${money(payload.amount, payload.currency)}. Suhbatda yoki buyurtma sahifasida qabul qiling.`,
        };
      }
      return {
        userId: payload.masterUserId as string,
        title: 'Yangi buyurtma',
        body: "Sizning taklifingiz qabul qilindi, buyurtma yaratildi.",
      };
    case 'order.status_changed': {
      const message = orderMessage(String(payload.newStatus), String(payload.actorType ?? ''), (payload.recipient ?? (payload.actorType === 'CUSTOMER' ? 'MASTER' : 'CUSTOMER')) !== 'MASTER');
      return { userId: payload.notifyUserId as string, ...message };
    }
    case 'payment.method_chosen': {
      const cash = payload.provider === 'CASH';
      return {
        userId: payload.masterUserId as string,
        title: cash ? 'Mijoz naqd to‘lovni tanladi' : `Mijoz ${PROVIDER[String(payload.provider)] ?? 'onlayn'} orqali to‘laydi`,
        body: cash
          ? `Mijoz ${money(payload.amount, payload.currency)} ni naqd pul bilan to‘laydi. Pulni olgach, buyurtma sahifasida «Naqd pulni qabul qildim» tugmasini bosing.`
          : `To‘lov summasi ${money(payload.amount, payload.currency)}. To‘lov yakunlangach sizga xabar beramiz.`,
      };
    }
    case 'payment.received':
      return {
        userId: payload.masterUserId as string,
        title: 'Mijoz to‘lovni amalga oshirdi',
        body: `${money(payload.amount, payload.currency)} (${PROVIDER[String(payload.provider)] ?? 'onlayn to‘lov'}) qabul qilindi.`,
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
    case 'order.reschedule_proposed':
      return {
        userId: payload.notifyUserId as string,
        title: 'Buyurtma vaqtini o‘zgartirish taklif qilindi',
        body: `Yangi taklif qilingan vaqt: ${formatUzDateTime(String(payload.proposedStartAt))}. Buyurtma sahifasida ko‘rib chiqing.`,
      };
    case 'order.reschedule_accepted':
      return {
        userId: payload.notifyUserId as string,
        title: 'Vaqt o‘zgartirish taklifi qabul qilindi',
        body: `Buyurtmaning yangi vaqti: ${formatUzDateTime(String(payload.scheduledStartAt))}.`,
      };
    case 'order.reschedule_declined':
      return {
        userId: payload.notifyUserId as string,
        title: 'Vaqt o‘zgartirish taklifi rad etildi',
        body: 'Boshqa vaqt taklif qilib ko‘ring yoki avvalgi belgilangan vaqtda davom eting.',
      };
    case 'order.reminder':
      return {
        userId: payload.notifyUserId as string,
        title: 'Buyurtma vaqti yaqinlashmoqda',
        body: `Belgilangan vaqt: ${formatUzDateTime(String(payload.scheduledStartAt))}.`,
      };
    default:
      return null;
  }
}
