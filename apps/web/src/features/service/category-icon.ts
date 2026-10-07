import { AirVent, Archive, Armchair, Bath, Cable, Droplet, Droplets, Hammer, KeyRound, Lightbulb, Plug, Snowflake, Sparkles, SprayCan, UtensilsCrossed, Waves, WashingMachine, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const RULES: Array<[pattern: RegExp, icon: LucideIcon]> = [
  [/santex|quvur|kran|unitaz|vanna|suv/i, Droplets],
  [/elektr|rozetka|sim|yoritgich|chiroq/i, Zap],
  [/kondits|sovut|isit/i, Snowflake],
  [/mebel|shkaf|yig/i, Armchair],
  [/tozala|tozalash|kir/i, Sparkles],
  [/maishiy|texnika|kir yuv|muzlatgich/i, WashingMachine],
  [/qulf|eshik|kalit/i, KeyRound],
  [/ta.?mir|qurilish|pardoz|bo.?yoq/i, Hammer],
];

/** Kategoriya (yoki xizmat) nomiga mos ikonani tanlaydi; topilmasa — umumiy ustaxona ikonasi. */
export function categoryIcon(name: string): LucideIcon {
  return RULES.find(([pattern]) => pattern.test(name))?.[1] ?? Wrench;
}

/** Xizmatning o‘ziga xos ikonasi (masalan, «Kran» — tomchi, «Unitaz» — vanna); topilmasa — kategoriya ikonasi. */
const SERVICE_RULES: Array<[pattern: RegExp, icon: LucideIcon]> = [
  [/kran|armatura/i, Droplet],
  [/unitaz|vanna/i, Bath],
  [/quvur/i, Waves],
  [/rozetka|o.?chirgich/i, Plug],
  [/elektr.*sim|sim/i, Cable],
  [/yoritgich|chiroq/i, Lightbulb],
  [/oshxona/i, UtensilsCrossed],
  [/shkaf/i, Archive],
  [/kondits.*(o.?rnat)/i, AirVent],
  [/uy tozala|ta.?mirdan/i, SprayCan],
];

export function serviceIcon(serviceName: string, categoryName: string): LucideIcon {
  return SERVICE_RULES.find(([pattern]) => pattern.test(serviceName))?.[1] ?? categoryIcon(`${categoryName} ${serviceName}`);
}
