import { registerAs } from '@nestjs/config';
import { intEnv } from './env.util';

const list = (value: string | undefined, fallback: string[]): string[] => {
  const items = (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
};

/**
 * Audio/video qo‘ng‘iroq (WebRTC) sozlamalari.
 * STUN — umumiy manzilni aniqlash (bepul). TURN — qattiq NAT/mobil tarmoqda media uzatish uchun ZARUR (o‘z serveringiz: coturn):
 *  - TURN_SECRET berilsa — vaqtinchalik (HMAC) login/parol yaratiladi (coturn `use-auth-secret`);
 *  - yoki TURN_USERNAME + TURN_CREDENTIAL (statik).
 */
export default registerAs('webrtc', () => ({
  stunUrls: list(process.env.STUN_URLS, ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']),
  turnUrls: list(process.env.TURN_URLS, []),
  turnSecret: process.env.TURN_SECRET ?? '',
  turnUsername: process.env.TURN_USERNAME ?? '',
  turnCredential: process.env.TURN_CREDENTIAL ?? '',
  turnTtlSeconds: intEnv('TURN_TTL_SECONDS', 3600),
  /** Javob berilmagan qo‘ng‘iroq shuncha soniyadan keyin «o‘tkazib yuborilgan» bo‘ladi. */
  ringSeconds: intEnv('CALL_RING_SECONDS', 45),
}));
