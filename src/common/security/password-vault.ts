import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Parolning shifrlangan (AES-256-GCM) nusxasi: faqat administrator ko‘rishi uchun.
 * Asosiy autentifikatsiya baribir bcrypt xeshi orqali ishlaydi; bu nusxa PASSWORD_VAULT_KEY bo‘lmasa ochilmaydi.
 * Format: v1.<iv>.<tag>.<shifrlangan matn> (base64url).
 */
function key(): Buffer | null {
  const raw = process.env.PASSWORD_VAULT_KEY?.trim();
  if (!raw) return null;
  const buffer = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buffer.length === 32 ? buffer : null;
}

export const passwordVaultEnabled = () => key() !== null;

export function sealPassword(plain: string): string | null {
  const secret = key();
  if (!secret) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

export function openPassword(sealed: string | null | undefined): string | null {
  const secret = key();
  if (!secret || !sealed) return null;
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
