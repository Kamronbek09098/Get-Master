import type { BadgeTone } from '@/components/ui/Badge';

export type AuditGroup =
  | 'auth'
  | 'verification'
  | 'users'
  | 'profile'
  | 'catalog'
  | 'requests'
  | 'offers'
  | 'orderFlow'
  | 'orders'
  | 'payments'
  | 'reviews'
  | 'customer'
  | 'disputes'
  | 'chat'
  | 'other';

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
  profile: { label: 'Usta faoliyati', prefix: 'MASTER_' },
  catalog: { label: 'Xizmatlar katalogi', prefix: 'SERVICE_' },
  requests: { label: 'So‘rovlar', prefix: 'REQUEST_' },
  offers: { label: 'Takliflar', prefix: 'OFFER_' },
  orderFlow: { label: 'Buyurtma jarayoni', prefix: 'ORDER_' },
  orders: { label: 'Admin — buyurtmalar', prefix: 'ADMIN_ORDER_' },
  payments: { label: 'To‘lovlar', prefix: 'PAYMENT_' },
  reviews: { label: 'Sharhlar', prefix: 'REVIEW_' },
  customer: { label: 'Mijoz profili', prefix: 'CUSTOMER_' },
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
  ADMIN_USER_PASSWORD_VIEWED: { label: 'Parol ko‘rilgan (eski yozuv)', verb: 'foydalanuvchi parolini ko‘rgan (bu imkoniyat bekor qilingan)', group: 'users', tone: 'warning' },
  AUTH_REGISTER_DUPLICATE_ATTEMPT: { label: 'Takroriy ro‘yxatdan o‘tish urinishi', verb: 'mavjud raqam/email bilan ro‘yxatdan o‘tmoqchi bo‘ldi', group: 'users', tone: 'warning' },
  ADMIN_USER_PASSWORD_RESET: { label: 'Parol o‘zgartirildi', verb: 'foydalanuvchi parolini o‘zgartirdi', group: 'users', tone: 'warning' },
  ADMIN_USER_DELETED: { label: 'Foydalanuvchi o‘chirildi', verb: 'foydalanuvchini o‘chirdi', group: 'users', tone: 'danger' },
  ADMIN_REGISTRATION_BLOCKED: { label: 'Qayta ro‘yxatdan o‘tish bloklandi', verb: 'qayta ro‘yxatdan o‘tishni blokladi', group: 'users', tone: 'danger' },
  ADMIN_REGISTRATION_ALLOWED: { label: 'Qayta ro‘yxatdan o‘tishga ruxsat berildi', verb: 'qayta ro‘yxatdan o‘tishga ruxsat berdi', group: 'users', tone: 'success' },
  USER_ACTION_CREATED: { label: 'Choralar qo‘llandi', verb: 'foydalanuvchiga chora qo‘lladi', group: 'users', tone: 'warning' },

  MASTER_PROFILE_CREATED: { label: 'Usta profili yaratildi', verb: 'usta profilini yaratdi', group: 'profile', tone: 'primary' },
  MASTER_PROFILE_UPDATED: { label: 'Usta profili yangilandi', verb: 'usta profilini yangiladi', group: 'profile', tone: 'neutral' },
  MASTER_STATUS_CHANGED: { label: 'Usta holati o‘zgardi', verb: 'profil holatini o‘zgartirdi', group: 'profile', tone: 'neutral' },
  MASTER_PAUSED: { label: 'Usta pauza qo‘ydi', verb: 'qabul qilishni pauza qildi', group: 'profile', tone: 'warning' },
  MASTER_RESUMED: { label: 'Usta pauzadan chiqdi', verb: 'pauzadan chiqdi', group: 'profile', tone: 'success' },
  MASTER_PORTFOLIO_CREATED: { label: 'Portfolio ishi qo‘shildi', verb: 'portfoliosiga yangi ish qo‘shdi', group: 'profile', tone: 'primary' },
  MASTER_PORTFOLIO_UPDATED: { label: 'Portfolio ishi yangilandi', verb: 'portfolio ishini yangiladi', group: 'profile', tone: 'neutral' },
  MASTER_PORTFOLIO_REMOVED: { label: 'Portfolio ishi o‘chirildi', verb: 'portfolio ishini o‘chirdi', group: 'profile', tone: 'warning' },
  ADMIN_PORTFOLIO_APPROVED: { label: 'Portfolio tasdiqlandi', verb: 'portfolio ishini tasdiqladi', group: 'profile', tone: 'success' },
  ADMIN_PORTFOLIO_REJECTED: { label: 'Portfolio rad etildi', verb: 'portfolio ishini rad etdi', group: 'profile', tone: 'danger' },

  REQUEST_CREATED: { label: 'So‘rov yaratildi', verb: 'yangi so‘rov yaratdi', group: 'requests', tone: 'primary' },
  REQUEST_UPDATED: { label: 'So‘rov yangilandi', verb: 'so‘rovni yangiladi', group: 'requests', tone: 'neutral' },
  REQUEST_SUBMITTED: { label: 'So‘rov yuborildi', verb: 'so‘rovni ustalarga yubordi', group: 'requests', tone: 'primary' },
  REQUEST_CANCELLED: { label: 'So‘rov bekor qilindi', verb: 'so‘rovni bekor qildi', group: 'requests', tone: 'danger' },

  OFFER_CREATED: { label: 'Taklif berildi', verb: 'so‘rovga taklif berdi', group: 'offers', tone: 'primary' },
  OFFER_WITHDRAWN: { label: 'Taklif qaytarib olindi', verb: 'taklifini qaytarib oldi', group: 'offers', tone: 'warning' },
  OFFER_ACCEPTED: { label: 'Taklif qabul qilindi', verb: 'taklifni qabul qildi', group: 'offers', tone: 'success' },

  ORDER_CONFIRMED: { label: 'Buyurtma tasdiqlandi', verb: 'buyurtmani tasdiqladi', group: 'orderFlow', tone: 'primary' },
  ORDER_ON_THE_WAY: { label: 'Usta yo‘lga chiqdi', verb: 'ish joyiga yo‘lga chiqdi', group: 'orderFlow', tone: 'primary' },
  ORDER_ARRIVED: { label: 'Usta yetib keldi', verb: 'ish joyiga yetib keldi', group: 'orderFlow', tone: 'primary' },
  ORDER_IN_PROGRESS: { label: 'Ish boshlandi', verb: 'ishni boshladi', group: 'orderFlow', tone: 'primary' },
  ORDER_WAITING_CONFIRMATION: { label: 'Tasdiq kutilmoqda', verb: 'ish yakunini tasdiqlash uchun yubordi', group: 'orderFlow', tone: 'warning' },
  ORDER_COMPLETED: { label: 'Buyurtma yakunlandi', verb: 'buyurtmani yakunladi', group: 'orderFlow', tone: 'success' },
  ORDER_CANCELLED: { label: 'Buyurtma bekor qilindi', verb: 'buyurtmani bekor qildi', group: 'orderFlow', tone: 'danger' },
  ORDER_DISPUTED: { label: 'Buyurtma bo‘yicha nizo ochildi', verb: 'buyurtma bo‘yicha nizo ochdi', group: 'orderFlow', tone: 'danger' },
  ORDER_RESCHEDULE_PROPOSED: { label: 'Yangi vaqt taklif qilindi', verb: 'buyurtma vaqtini o‘zgartirishni taklif qildi', group: 'orderFlow', tone: 'neutral' },
  ORDER_RESCHEDULE_ACCEPTED: { label: 'Yangi vaqt tasdiqlandi', verb: 'yangi vaqtni tasdiqladi', group: 'orderFlow', tone: 'success' },
  ORDER_RESCHEDULE_DECLINED: { label: 'Yangi vaqt rad etildi', verb: 'taklif qilingan vaqtni rad etdi', group: 'orderFlow', tone: 'warning' },

  ADMIN_ORDER_CANCELLED: { label: 'Buyurtma bekor qilindi', verb: 'buyurtmani bekor qildi', group: 'orders', tone: 'danger' },
  ADMIN_ORDER_COMPLETED: { label: 'Nizoli buyurtma yakunlandi', verb: 'nizoli buyurtmani yakunladi', group: 'orders', tone: 'success' },

  SERVICE_CATEGORY_CREATED: { label: 'Kategoriya yaratildi', verb: 'xizmat kategoriyasini yaratdi', group: 'catalog', tone: 'primary' },
  SERVICE_CREATED: { label: 'Xizmat yaratildi', verb: 'yangi xizmat qo‘shdi', group: 'catalog', tone: 'primary' },
  SERVICE_UPDATED: { label: 'Xizmat yangilandi', verb: 'xizmatni yangiladi', group: 'catalog', tone: 'neutral' },
  SERVICE_DEACTIVATED: { label: 'Xizmat o‘chirildi', verb: 'xizmatni faolsizlantirdi', group: 'catalog', tone: 'warning' },

  DISPUTE_STATUS_CHANGED: { label: 'Nizo holati o‘zgardi', verb: 'nizo holatini o‘zgartirdi', group: 'disputes', tone: 'warning' },
  COMPLAINT_STATUS_CHANGED: { label: 'Shikoyat holati o‘zgardi', verb: 'shikoyat holatini o‘zgartirdi', group: 'disputes', tone: 'warning' },
  APPEAL_CREATED: { label: 'Apellyatsiya yuborildi', verb: 'apellyatsiya yubordi', group: 'disputes', tone: 'primary' },
  APPEAL_UPDATED: { label: 'Apellyatsiya yangilandi', verb: 'apellyatsiyani ko‘rib chiqdi', group: 'disputes', tone: 'warning' },
  WARRANTY_CREATED: { label: 'Kafolat ochildi', verb: 'buyurtmaga kafolat ochdi', group: 'disputes', tone: 'primary' },
  WARRANTY_CLAIM_CREATED: { label: 'Kafolat da’vosi yuborildi', verb: 'kafolat bo‘yicha da’vo yubordi', group: 'disputes', tone: 'primary' },
  WARRANTY_CLAIM_UPDATED: { label: 'Kafolat da’vosi yangilandi', verb: 'kafolat da’vosini yangiladi', group: 'disputes', tone: 'warning' },
  COMPENSATION_CREATED: { label: 'Kompensatsiya berildi', verb: 'kompensatsiya ajratdi', group: 'disputes', tone: 'success' },

  CHAT_MESSAGE_EDITED: { label: 'Xabar tahrirlandi', verb: 'chatdagi xabarni tahrir qildi', group: 'chat', tone: 'warning' },
  CHAT_MESSAGE_DELETED: { label: 'Xabar o‘chirildi', verb: 'chatdagi xabarni o‘chirdi', group: 'chat', tone: 'danger' },

  PAYMENT_CASH_CONFIRMED: { label: 'Naqd to‘lov tasdiqlandi', verb: 'naqd to‘lovni tasdiqladi', group: 'payments', tone: 'success' },
  PAYMENT_REFUNDED: { label: 'To‘lov qaytarildi', verb: 'to‘lovni qaytardi', group: 'payments', tone: 'warning' },
  PAYMENT_WEBHOOK_MISMATCH: { label: 'To‘lov webhook’i mos kelmadi', verb: 'to‘lov webhook’i mos kelmadi', group: 'payments', tone: 'danger' },

  REVIEW_CREATED: { label: 'Sharh qoldirildi', verb: 'ustaga sharh qoldirdi', group: 'reviews', tone: 'primary' },

  CUSTOMER_PROFILE_UPDATED: { label: 'Mijoz profili yangilandi', verb: 'profilini yangiladi', group: 'customer', tone: 'neutral' },
  CUSTOMER_ADDRESS_CREATED: { label: 'Manzil qo‘shildi', verb: 'yangi manzil qo‘shdi', group: 'customer', tone: 'primary' },
  CUSTOMER_ADDRESS_UPDATED: { label: 'Manzil yangilandi', verb: 'manzilni yangiladi', group: 'customer', tone: 'neutral' },
  CUSTOMER_ADDRESS_REMOVED: { label: 'Manzil o‘chirildi', verb: 'manzilni o‘chirdi', group: 'customer', tone: 'warning' },
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
  MasterPortfolio: 'Portfolio ishi',
  DeviceSession: 'Qurilma sessiyasi',
  Service: 'Xizmat',
  ServiceCategory: 'Xizmat kategoriyasi',
  Case: 'Nizo / shikoyat',
  Message: 'Chat xabari',
  Order: 'Buyurtma',
  Payment: 'To‘lov',
  ProblemRequest: 'So‘rov',
  Offer: 'Taklif',
  Address: 'Manzil',
  Review: 'Sharh',
  Warranty: 'Kafolat',
  WarrantyClaim: 'Kafolat da’vosi',
  Appeal: 'Apellyatsiya',
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
