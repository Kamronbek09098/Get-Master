/** Platforma komissiyasi: ustadan olinadi (mijoz narxga qo‘shimcha to‘lamaydi). Standart — 5%. */
export const DEFAULT_COMMISSION_RATE = 0.05;

export function commissionRate(): number {
  const raw = process.env.PLATFORM_COMMISSION_RATE;
  if (raw === undefined || raw.trim() === '') return DEFAULT_COMMISSION_RATE;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 0.5 ? value : DEFAULT_COMMISSION_RATE;
}

/** Buyurtma summasi bo‘yicha: platforma ulushi (tiyingacha yaxlitlanadi) va ustaga qoladigan qism. */
export function splitCommission(amount: number, rate: number = commissionRate()): { platformFee: number; masterAmount: number } {
  const platformFee = Math.round(amount * rate * 100) / 100;
  return { platformFee, masterAmount: Math.round((amount - platformFee) * 100) / 100 };
}
