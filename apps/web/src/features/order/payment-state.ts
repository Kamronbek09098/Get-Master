/** To‘lov to‘liq amalga oshgan (qabul qilingan) holatlari: faqat shundan keyin ishni tasdiqlash mumkin. */
export function isPaymentSettled(payment: { status: string } | null | undefined): boolean {
  return !!payment && (payment.status === 'SUCCEEDED' || payment.status === 'PARTIALLY_REFUNDED');
}
