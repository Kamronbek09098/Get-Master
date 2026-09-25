import type { BadgeTone } from '@/components/ui/Badge';

export type AuditGroup = 'auth' | 'verification' | 'users' | 'profile' | 'catalog' | 'disputes' | 'chat' | 'other';

export interface AuditActionInfo {
  /** Qisqa sarlavha. */
  label: string;
  /** Aktordan keyin keladigan fe’l: «Admin … hujjatni tasdiqladi». */
  verb: string;
  group: AuditGroup;
  tone: BadgeTone;
}

export const GROUP_INFO: Record<AuditGroup, { label: string; prefix?: string }> = {
  auth: { label: 'Kirish va sessiyalar', prefix: 'AUTH_' },
  verification: { label: 'Ustalarni tasdiqlash', prefix: 'VERIFICATION_' },
  users: { label: 'Foydalanuvchilar', prefix: 'ADMIN_USER_' },
  profile: { label: 'Usta profili', prefix: 'MASTER_PROFILE_' },
  catalog: { label: 'Xizmatlar katalogi', prefix: 'SERVICE_' },
  disputes: { label: 'Nizo va shikoyatlar', prefix: 'DISPUTE_' },
  chat: { label: 'Chat moderatsiyasi', prefix: 'CHAT_' },
  other: { label: 'Boshqa' },
};

export const AUDIT_ACTIONS: Record<string, AuditActionInfo> = {
  AUTH_REGISTERED: { label: 'Ro‘yxatdan o‘tdi', verb: 'ro‘yxatdan o‘tdi', group: 'auth', tone: 'primary' },
  AUTH_REGISTRATION_VERIFIED: { label: 'Ro‘yxatdan o‘tish tasdiqlandi', verb: 'telefon raqamini tasdiqladi', group: 'auth', tone: 'success' },
  AUTH_LOGIN_COMPLETED: { label: 'Tizimga kirdi', verb: 'tizimga kirdi', group: 'auth', tone: 'success' },
  AUTH_LOGOUT: { label: 'Tizimdan chiqdi', verb: 'tizimdan chiqdi', group: 'auth', tone: 'neutral' },
  AUTH_LOGOUT_ALL: { label: 'Barcha qurilmalardan chiqdi', verb: 'barcha qurilmalardan chiqdi', group: 'auth', tone: 'warning' },
  AUTH_REFRESH_ROTATED: { label: 'Sessiya yangilandi', verb: 'sessiyasini yangiladi', group: 'auth', tone: 'neutral' },
  AUTH_SESSION_REVOKED: { label: 'Qurilma sessiyasi tugatildi', verb: 'qurilma sessiyasini tugatdi', group: 'auth', tone: 'warning' },
  AUTH_OTHER_SESSIONS_REVOKED: { label: 'Boshqa qurilmalar chiqarildi', verb: 'boshqa qurilmalarini tizimdan chiqardi', group: 'auth', tone: 'warning' },

  VERIFICATION_SUBMITTED: { label: 'Hujjat yuborildi', verb: 'tasdiqlash uchun hujjat yubordi', group: 'verification', tone: 'primary' },
  VERIFICATION_START_REVIEW: { label: 'Ko‘rib chiqish boshlandi', verb: 'hujjatni ko‘rib chiqishni boshladi', group: 'verification', tone: 'primary' },
  VERIFICATION_APPROVE: { label: 'Hujjat tasdiqlandi', verb: 'hujjatni tasdiqladi', group: 'verification', tone: 'success' },
  VERIFICATION_REJECT: { label: 'Hujjat rad etildi', verb: 'hujjatni rad etdi', group: 'verification', tone: 'danger' },
  VERIFICATION_REQUEST_CORRECTION: { label: 'Tuzatish so‘raldi', verb: 'hujjatni tuzatishni so‘radi', group: 'verification', tone: 'warning' },
  VERIFICATION_DELETED: { label: 'Hujjat o‘chirildi', verb: 'hujjatni o‘chirdi', group: 'verification', tone: 'danger' },

  ADMIN_USER_SUSPENDED: { label: 'Foydalanuvchi to‘xtatildi', verb: 'foydalanuvchini to‘xtatdi', group: 'users', tone: 'warning' },
  ADMIN_USER_REACTIVATED: { label: 'Foydalanuvchi qayta faollashtirildi', verb: 'foydalanuvchini qayta faollashtirdi', group: 'users', tone: 'success' },
  ADMIN_USER_DELETED: { label: 'Foydalanuvchi o‘chirildi', verb: 'foydalanuvchini o‘chirdi', group: 'users', tone: 'danger' },
  USER_ACTION_CREATED: { label: 'Choralar qo‘llandi', verb: 'foydalanuvchiga chora qo‘lladi', group: 'users', tone: 'warning' },

  MASTER_PROFILE_CREATED: { label: 'Usta profili yaratildi', verb: 'usta profilini yaratdi', group: 'profile', tone: 'primary' },
  MASTER_PROFILE_UPDATED: { label: 'Usta profili yangilandi', verb: 'usta profilini yangiladi', group: 'profile', tone: 'neutral' },
  ADMIN_PORTFOLIO_APPROVED: { label: 'Portfolio tasdiqlandi', verb: 'portfolio ishini tasdiqladi', group: 'profile', tone: 'success' },
  ADMIN_PORTFOLIO_REJECTED: { label: 'Portfolio rad etildi', verb: 'portfolio ishini rad etdi', group: 'profile', tone: 'danger' },

  SERVICE_CATEGORY_CREATED: { label: 'Kategoriya yaratildi', verb: 'xizmat kategoriyasini yaratdi', group: 'catalog', tone: 'primary' },
  SERVICE_CREATED: { label: 'Xizmat yaratildi', verb: 'yangi xizmat qo‘shdi', group: 'catalog', tone: 'primary' },
  SERVICE_UPDATED: { label: 'Xizmat yangilandi', verb: 'xizmatni yangiladi', group: 'catalog', tone: 'neutral' },
  SERVICE_DEACTIVATED: { label: 'Xizmat o‘chirildi', verb: 'xizmatni faolsizlantirdi', group: 'catalog', tone: 'warning' },

  DISPUTE_STATUS_CHANGED: { label: 'Nizo holati o‘zgardi', verb: 'nizo holatini o‘zgartirdi', group: 'disputes', tone: 'warning' },
  COMPLAINT_STATUS_CHANGED: { label: 'Shikoyat holati o‘zgardi', verb: 'shikoyat holatini o‘zgartirdi', group: 'disputes', tone: 'warning' },
  APPEAL_UPDATED: { label: 'Apellyatsiya yangilandi', verb: 'apellyatsiyani ko‘rib chiqdi', group: 'disputes', tone: 'warning' },
  WARRANTY_CLAIM_UPDATED: { label: 'Kafolat da’vosi yangilandi', verb: 'kafolat da’vosini yangiladi', group: 'disputes', tone: 'warning' },

  CHAT_MESSAGE_EDITED: { label: 'Xabar tahrirlandi', verb: 'chatdagi xabarni tahrir qildi', group: 'chat', tone: 'warning' },
  CHAT_MESSAGE_DELETED: { label: 'Xabar o‘chirildi', verb: 'chatdagi xabarni o‘chirdi', group: 'chat', tone: 'danger' },

  PAYMENT_WEBHOOK_MISMATCH: { label: 'To‘lov webhook’i mos kelmadi', verb: 'to‘lov webhook’i mos kelmadi', group: 'other', tone: 'danger' },
};

const humanize = (code: string) => {
  const text = code.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function actionInfo(action: string): AuditActionInfo {
  return AUDIT_ACTIONS[action] ?? { label: humanize(action), verb: humanize(action).toLowerCase(), group: 'other', tone: 'neutral' };
}

export const TARGET_LABEL: Record<string, string> = {
  User: 'Foydalanuvchi',
  MasterVerification: 'Tasdiqlash hujjati',
  MasterProfile: 'Usta profili',
  DeviceSession: 'Qurilma sessiyasi',
  Service: 'Xizmat',
  ServiceCategory: 'Xizmat kategoriyasi',
  Case: 'Nizo / shikoyat',
  Message: 'Chat xabari',
  Order: 'Buyurtma',
  Payment: 'To‘lov',
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  UNDER_REVIEW: 'Ko‘rib chiqilmoqda',
  VERIFIED: 'Tasdiqlangan',
  APPROVED: 'Tasdiqlangan',
  REJECTED: 'Rad etilgan',
  NEEDS_CORRECTION: 'Tuzatish kerak',
  CORRECTION_REQUESTED: 'Tuzatish kerak',
  ACTIVE: 'Faol',
  INACTIVE: 'Faol emas',
  SUSPENDED: 'To‘xtatilgan',
  DELETED: 'O‘chirilgan',
  OPEN: 'Ochiq',
  IN_REVIEW: 'Ko‘rib chiqilmoqda',
  RESOLVED: 'Hal qilingan',
  CLOSED: 'Yopilgan',
  ESCALATED: 'Yuqoriga uzatilgan',
};

export const DOCUMENT_LABEL: Record<string, string> = {
  IDENTITY: 'Shaxsni tasdiqlovchi hujjat',
  LICENSE: 'Litsenziya',
  CERTIFICATE: 'Sertifikat',
  PASSPORT: 'Pasport',
};

export const FIELD_LABEL: Record<string, string> = {
  status: 'Holat',
  documentType: 'Hujjat turi',
  reason: 'Sabab',
  role: 'Rol',
  name: 'Nomi',
  isActive: 'Faolligi',
};

export function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ha' : 'Yo‘q';
  if (typeof value === 'string') {
    if (key === 'status' || key.toLowerCase().endsWith('status')) return STATUS_LABEL[value] ?? humanize(value);
    if (key === 'documentType') return DOCUMENT_LABEL[value] ?? humanize(value);
    return value;
  }
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}
