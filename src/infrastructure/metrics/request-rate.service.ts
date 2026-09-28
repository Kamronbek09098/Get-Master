import { Injectable } from '@nestjs/common';

export type TrafficWindow = '1h' | '24h' | '7d';

export interface TrafficBucket {
  /** ISO vaqt yorlig'i (bucket boshlanishi). */
  at: string;
  count: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const KEEP_MINUTES = 180; // 3 soat — 1 soatlik ko'rinish uchun daqiqama-daqiqa zaxira
const KEEP_HOURS = 168; // 7 kun — 24 soat va 7 kunlik ko'rinish uchun soatma-soat zaxira

/** Har bir API so'rovini xotirada (daqiqa/soat bo'yicha) hisoblab boradi — Prometheus/Grafana o'rniga admin panelida jonli trafik grafigini chizish uchun. Qayta ishga tushganda tozalanadi. */
@Injectable()
export class RequestRateService {
  private readonly perMinute = new Map<number, number>();
  private readonly perHour = new Map<number, number>();

  record(): void {
    const now = Date.now();
    const minuteKey = Math.floor(now / MINUTE_MS);
    const hourKey = Math.floor(now / HOUR_MS);
    this.perMinute.set(minuteKey, (this.perMinute.get(minuteKey) ?? 0) + 1);
    this.perHour.set(hourKey, (this.perHour.get(hourKey) ?? 0) + 1);
    this.prune();
  }

  series(window: TrafficWindow): TrafficBucket[] {
    const now = Date.now();
    if (window === '1h') {
      const currentMinute = Math.floor(now / MINUTE_MS);
      return Array.from({ length: 60 }, (_, i) => {
        const key = currentMinute - (59 - i);
        return { at: new Date(key * MINUTE_MS).toISOString(), count: this.perMinute.get(key) ?? 0 };
      });
    }
    const currentHour = Math.floor(now / HOUR_MS);
    const hours = window === '24h' ? 24 : 24 * 7;
    return Array.from({ length: hours }, (_, i) => {
      const key = currentHour - (hours - 1 - i);
      return { at: new Date(key * HOUR_MS).toISOString(), count: this.perHour.get(key) ?? 0 };
    });
  }

  private prune(): void {
    const now = Date.now();
    const minCutoff = Math.floor(now / MINUTE_MS) - KEEP_MINUTES;
    const hourCutoff = Math.floor(now / HOUR_MS) - KEEP_HOURS;
    for (const key of this.perMinute.keys()) if (key < minCutoff) this.perMinute.delete(key);
    for (const key of this.perHour.keys()) if (key < hourCutoff) this.perHour.delete(key);
  }
}
