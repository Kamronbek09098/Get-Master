import type { Maneuver } from './geometry';
import { maneuverText } from './instructions';

const BASE = '/voice/uz';
export type VoiceEvent = 'route-ready' | 'reroute' | 'reroute-done' | 'near-destination';

/** Masofa bosqichlari (metr): burilishdan shuncha oldin ovozli ogohlantiriladi; 0 — «hozir». */
export const TIERS = [3000, 1000, 500, 200, 0] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Berilgan masofada qaysi bosqich e’lon qilinishi kerak: burilishgacha masofa bosqichga yetgan (yoki undan kam) eng yaqin bosqich,
 * lekin qadamning o‘zi bosqichdan qisqa bo‘lsa, shu bosqich o‘tkazib yuboriladi (masalan, 300 m lik ko‘chada «1 km dan keyin» deyilmaydi).
 */
export function tierFor(toNextM: number, stepLengthM: number): Tier | null {
  let pick: Tier | null = null;
  for (const tier of TIERS) {
    if (tier === 0) {
      if (toNextM <= 60) pick = 0;
    } else if (toNextM <= tier * 1.04 && toNextM >= tier * 0.78 && stepLengthM > tier * 1.15) {
      pick = tier;
    }
  }
  return pick;
}

/** Ovoz fayli bor eng yaqin masofa so‘zi (metr): 3000, 1000, 500, 200 → d-<n>. */
const clipOf = (tier: Exclude<Tier, 0>) => `${BASE}/d-${tier}.mp3`;

/** O‘zbekcha ovozli ko‘rsatma: oldindan tayyorlangan neyron ovoz fayllari (internetsiz ham ishlaydi); fayl topilmasa brauzer ovozi. */
export class NavVoice {
  private queue: string[][] = [];
  private playing = false;
  private current: HTMLAudioElement | null = null;
  private unlocked = false;
  enabled = true;
  /** «Faqat muhim»: uzoq ogohlantirishlar (3 km, 1 km) aytilmaydi; yaqin burilish va hodisalar aytiladi. */
  importantOnly = false;
  /** Ovoz balandligi (0–1). */
  volume = 0.7;
  private cache = new Map<string, HTMLAudioElement>();

  /** Brauzer avtomatik ijroni foydalanuvchi bosishidan keyin ruxsat beradi: birinchi bosishda chaqiriladi. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const probe = new Audio(`${BASE}/m-straight.mp3`);
    probe.volume = 0;
    void probe.play().then(() => probe.pause()).catch(() => undefined);
  }

  /** Eng ko‘p ishlatiladigan fayllarni oldindan yuklaydi. */
  preload() {
    ['m-left', 'm-right', 'm-straight', 'm-arrive', 'd-500', 'd-200', 'e-route-ready'].forEach((name) => this.audio(`${BASE}/${name}.mp3`));
  }

  private audio(src: string): HTMLAudioElement {
    let a = this.cache.get(src);
    if (!a) {
      a = new Audio(src);
      a.preload = 'auto';
      this.cache.set(src, a);
    }
    return a;
  }

  stop() {
    this.queue = [];
    this.current?.pause();
    this.current = null;
    this.playing = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  /** Burilish: bosqichga qarab «<masofa> dan keyin, <manevr>» yoki faqat manevr. Ko‘cha nomi aytilmaydi (ekranda ko‘rinadi). */
  announce(maneuver: Maneuver, tier: Tier, street = '') {
    if (this.importantOnly && (tier === 3000 || tier === 1000)) return;
    const clips = tier === 0 ? [`${BASE}/m-${maneuver}.mp3`] : [clipOf(tier), `${BASE}/m-${maneuver}.mp3`];
    this.say(clips, `${tier === 0 ? '' : `${tier >= 1000 ? tier / 1000 + ' kilometr' : tier + ' metr'}dan keyin, `}${maneuverText(maneuver, street)}`);
  }

  /** Sozlamalarda ovozni sinab ko‘rish. */
  sample() {
    const was = this.enabled;
    this.enabled = true;
    this.say([`${BASE}/m-left.mp3`], 'Chapga buriling');
    this.enabled = was;
  }

  event(name: VoiceEvent, fallback: string) {
    this.say([`${BASE}/e-${name}.mp3`], fallback);
  }

  private say(clips: string[], fallbackText: string) {
    if (!this.enabled) return;
    this.queue = [clips]; // eskisi to‘xtatiladi: faqat eng dolzarb ko‘rsatma
    this.current?.pause();
    this.playing = false;
    this.fallback = fallbackText;
    void this.pump();
  }

  private fallback = '';
  private async pump() {
    if (this.playing) return;
    const clips = this.queue.shift();
    if (!clips) return;
    this.playing = true;
    try {
      for (const src of clips) {
        const a = this.audio(src);
        this.current = a;
        a.volume = this.volume;
        a.currentTime = 0;
        await new Promise<void>((resolve, reject) => {
          a.onended = () => resolve();
          a.onerror = () => reject(new Error('clip'));
          a.play().catch(reject);
        });
      }
    } catch {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && this.fallback) {
        const utterance = new SpeechSynthesisUtterance(this.fallback);
        utterance.lang = 'uz-UZ';
        utterance.volume = this.volume;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    } finally {
      this.playing = false;
      if (this.queue.length) void this.pump();
    }
  }
}
