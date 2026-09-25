import { Armchair, Droplets, Hammer, KeyRound, Snowflake, Sparkles, WashingMachine, Wrench, Zap } from 'lucide-react';
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
