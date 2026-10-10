import type { CaseStatus } from '@/features/dispute/types';
import type { MasterVerificationStatus } from '@/features/master/types';
import type { PaymentProvider, PaymentStatus } from '@/types/common';

export type DevOpsWindow = '1h' | '24h' | '7d' | '30d';

export interface DevOpsIssue {
  level: 'warning' | 'danger';
  message: string;
}

export interface DevOpsPing {
  ok: boolean;
  latencyMs: number | null;
}

export interface DevOpsTrafficPoint {
  at: string;
  count: number;
  errors: number;
  p95Ms: number | null;
}

export interface DevOpsSnapshot {
  checkedAt: string;
  issues: DevOpsIssue[];
  system: {
    hostname: string;
    platform: string;
    cpuCount: number;
    cpuPercent: number;
    loadAvg: [number, number, number];
    totalMemMB: number;
    freeMemMB: number;
    usedMemPercent: number;
    uptimeSeconds: number;
    disk: { totalGB: number; usedGB: number; freeGB: number; usedPercent: number } | null;
  };
  process: {
    supervisor: 'pm2' | 'systemd' | 'docker' | 'none';
    pid: number;
    nodeVersion: string;
    uptimeSeconds: number;
    rssMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    heapLimitMB: number;
    cpuUserMs: number;
    cpuSystemMs: number;
  };
  version: {
    appVersion: string;
    commit: string | null;
    environment: string;
    nodeVersion: string;
    startedAt: string;
  };
  dependencies: {
    database: DevOpsPing;
    redis: DevOpsPing;
    telegramAlerting: boolean;
  };
  backup: { configured: boolean; message: string; stale: boolean; ageHours: number | null; lastAt: string | null; sizeMB: number | null; file: string | null; count: number; keepDaily: number };
  providers: Array<{ key: string; label: string; provider: string; state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'; success: number; failure: number; circuitOpen: number; lastOkAt: string | null; lastFailureAt: string | null; lastError: string | null; avgLatencyMs: number | null; lastLatencyMs: number | null; successRate: number | null }>;
  errors: { lastHour: number; last24h: number; logged24h: number; series: Array<{ at: string; count: number }> };
  history: Array<{ at: string; cpu: number; mem: number; disk: number | null; heapMB: number }>;
  traffic: DevOpsTrafficPoint[];
  trafficSummary: {
    requests: number;
    perMinute: number;
    errors: number;
    errorRate: number;
    p95Ms: number | null;
    previous: { perMinute: number; errorRate: number; p95Ms: number | null } | null;
  };
  topEndpoints: Array<{ route: string; count: number; percent: number }>;
}

export interface SubscriptionAudienceStats {
  planCode: string | null;
  planName: string | null;
  monthlyPrice: number | null;
  active: number;
  pending: number;
  expiringSoon: number;
  purchased: number;
  gifted: number;
  revenue: string | number;
}

export interface Dashboard {
  users: { total: number; byStatus: Record<string, number> };
  masters: { total: number; byStatus: Record<string, number>; byVerification: Record<string, number> };
  requests: { total: number; submitted: number; byStatus: Record<string, number> };
  bookings: { total: number };
  orders: { total: number; byStatus: Record<string, number> };
  payments: { byStatus: Record<string, unknown> };
  disputes: { total: number; byStatus: Record<string, number> };
  reviews: { total: number; averageRating: number | string };
  attention: { pendingVerifications: number; openCases: number; pendingSubscriptions: number; activeOrders: number; errors24h: number };
  today: { newUsers: number; newRequests: number; newOrders: number; completedOrders: number; revenue: string | number };
  subscriptions: {
    activeTotal: number;
    revenueTotal: string | number;
    customer: SubscriptionAudienceStats;
    master: SubscriptionAudienceStats;
  };
  feed: { posts: number; views: number; likes: number; shares: number; comments: number };
  recentOrders: Array<{
    id: string;
    orderNumber: number;
    status: string;
    createdAt: string;
    finalAmount: string | number;
    currency: string;
    customer: { id: string; accountNumber: number; firstName: string | null; lastName: string | null };
    master: { id: string; accountNumber: number; firstName: string | null; lastName: string | null };
    service: string;
  }>;
}

export interface OrdersSeries {
  days: 7 | 30 | 90;
  points: Array<{ date: string; created: number; completed: number }>;
}

export interface RevenueSummary {
  totalRevenue: string;
  totalRefunded: string;
  netRevenue: string;
  platformProfit: string;
  commissionRate: number;
  totalPayments: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  disputeCount: number;
}

export interface ReportTotals {
  revenue: number;
  refunded: number;
  settledPayments: number;
  payments: number;
  orders: number;
  active: number;
  completed: number;
  cancelled: number;
  platformFee: number;
  completedWithoutFee: number;
}

export interface ReportsOverview {
  commissionRate: number;
  range: { from: string; to: string; all: boolean };
  current: ReportTotals;
  previous: ReportTotals | null;
  series: Array<{ date: string; revenue: number; refunded: number; payments: number; orders: number; active: number; completed: number; cancelled: number }>;
  paymentStatus: Record<'succeeded' | 'pending' | 'refunded' | 'failed' | 'cancelled', { count: number; amount: number }>;
  reconciliation: { mismatchCount: number; items: Array<{ paymentId: string; recorded: number; ledger: number; difference: number }> };
}

export interface ReportPaymentRow {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: string;
  refundedAmount: string;
  currency: string;
  createdAt: string;
  succeededAt: string | null;
  order: { orderNumber: number };
  customer: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string };
}

export interface ReportPaymentsPage {
  items: ReportPaymentRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  filteredSettled: { amount: number; refunded: number };
}

export interface RevenueRow {
  id: string;
  orderId: string;
  provider: string;
  amount: string;
  refundedAmount: string;
  currency: string;
  succeededAt: string | null;
}

export type ManagedStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'BLOCKED' | 'DELETED';

export interface AdminUserSubscription {
  planCode: string;
  planName: string;
  endsAt: string;
  startsAt?: string | null;
  source?: string;
  months?: number;
  daysLeft: number;
}

export interface AdminUser {
  id: string;
  accountNumber: number;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Profil rasmi manzili (yuklangan rasm yoki Google rasmi). */
  avatar?: string | null;
  status: ManagedStatus;
  createdAt: string;
  deletedAt: string | null;
  lastLoginAt?: string | null;
  phoneVerifiedAt?: string | null;
  /** Mijoz va usta sifatidagi barcha buyurtmalar soni. */
  ordersCount?: number;
  subscription?: AdminUserSubscription | null;
  roles: Array<'CUSTOMER' | 'MASTER' | 'ADMIN'>;
  masterProfile: {
    id: string;
    profession: string | null;
    status: string;
    verification: MasterVerificationStatus;
    ratingAvg: string;
    ratingCount?: number;
    completedOrders: number;
  } | null;
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminUserStats {
  total: { all: number; customers: number; masters: number; new30: number; growthPercent: number | null };
  active: { all: number; customers: number; masters: number };
  blocked: { all: number; customers: number; masters: number; suspended: number };
  pending: { all: number; customers: number; masters: number };
}

export interface UserFilters {
  role?: 'CUSTOMER' | 'MASTER' | 'ADMIN';
  status?: ManagedStatus;
  search?: string;
  sort?: 'createdAt' | 'lastLoginAt' | 'name';
  dir?: 'asc' | 'desc';
  from?: string;
  to?: string;
  subscription?: 'any' | 'none' | 'CUSTOMER_PLUS' | 'MASTER_PRO';
}

export interface AdminActor {
  accountNumber?: number;
  firstName: string | null;
  lastName: string | null;
}

export interface AdminVerification {
  id: string;
  masterId: string;
  documentType: string;
  mediaAssetId: string | null;
  status: MasterVerificationStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: AdminActor | null;
  actions?: Array<{ action: string; reason: string | null; createdAt: string; actor: AdminActor | null }>;
  master: {
    id: string;
    profession: string | null;
    verification: MasterVerificationStatus;
    user: { accountNumber?: number; firstName: string | null; lastName: string | null };
  };
}

export interface AdminPortfolioItem {
  id: string;
  title: string | null;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  mediaAssetId: string | null;
  beforeMediaAssetId?: string | null;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: AdminActor | null;
  master: {
    id: string;
    profession: string | null;
    user: { accountNumber?: number; firstName: string | null; lastName: string | null };
  };
}

export type VerificationDecision = 'START_REVIEW' | 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION';

export interface AuditLog {
  id: string;
  actorId: string | null;
  actor?: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string } | null;
  before?: unknown;
  after?: unknown;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  ipAddress: string | null;
  requestId: string | null;
  device?: string | null;
  createdAt: string;
  /** Qisqa kod: AUD-XXXXXXXX. */
  code?: string;
  /** SUCCESS — oddiy bajarilgan; FAILED — rad etilgan yoki xato bilan tugagan. */
  outcome?: 'SUCCESS' | 'FAILED';
  /** Amal kimga nisbatan bajarilgan (foydalanuvchi yoki usta hujjati egasi). */
  targetUser?: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string } | null;
  targetDocumentType?: string | null;
  actorRole?: AuditActorRole;
}

export interface AdminUserDetail {
  id: string;
  accountNumber: number;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  /** Yuklangan profil rasmi (yoki Google rasmi) manzili. */
  avatar?: string | null;
  adminAvatarAllowed?: boolean;
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  deletedAt: string | null;
  /** O‘chirilgan akkaunt raqamidan qayta ro‘yxatdan o‘tish admin tomonidan taqiqlanganmi. */
  registrationBlocked?: boolean;
  /** Kirishda OTP so‘ralishi (superadmin boshqaradi). */
  twoFactorEnabled?: boolean;
  lastLoginAt: string | null;
  phoneVerifiedAt: string | null;
  roles: Array<'CUSTOMER' | 'MASTER' | 'ADMIN'>;
  masterProfile: {
    id: string;
    profession: string | null;
    bio: string | null;
    experienceYears: number | null;
    status: string;
    verification: MasterVerificationStatus;
    ratingAvg: string;
    completedOrders: number;
  } | null;
  stats: { orders: number; requests: number; messages: number; reviews: number; activeDevices: number };
  lastSession: { lastSeenAt: string; ipAddress: string | null; userAgent: string | null; panel: string | null } | null;
  subscription?: AdminUserSubscription | null;
  subscriptionHistory?: Array<{ id: string; planCode: string; planName: string; months: number; amount: string; currency: string; status: string; source: string; method: string | null; note: string | null; startsAt: string | null; endsAt: string | null; createdAt: string }>;
  subscriptionSummary?: { everSubscribed: boolean; total: number; purchased: number; gifted: number; totalPaid: number; firstAt: string | null; lastAt: string | null };
  activity?: {
    ordersAsCustomer: Record<string, number>;
    ordersAsMaster: Record<string, number>;
    spent: number;
    earned: number | null;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
  };
  account?: { googleLinked: boolean; googleEmail: string | null; hasPassword: boolean; createdByAdmin: boolean };
  recentActivity: Array<{ id: string; action: string; reason: string | null; actorId: string | null; actor?: { accountNumber: number } | null; createdAt: string }>;
  addresses?: Array<{ id: string; title: string | null; addressLine: string; city: string | null; district: string | null; isDefault: boolean }>;
  recentOrders?: Array<{ id: string; orderNumber: number; status: string; finalAmount: string; currency: string; createdAt: string; side: 'CUSTOMER' | 'MASTER' }>;
  masterExtra?: {
    ratingCount: number;
    workPlace?: string | null;
    completionRate: string;
    responseRate: string;
    workRadiusKm: string | null;
    serviceAreas: unknown;
    isPaused: boolean;
    services: Array<{ name: string; basePrice: string | null }>;
  } | null;
}

export interface AdminBadges {
  verifications: number;
  cases: number;
  appeals: number;
  users: number;
  chats: number;
  orders: number;
  now: string;
}

export type AuditActorRole = 'ADMIN' | 'MASTER' | 'CUSTOMER' | 'SYSTEM';

export type AuditSummary = Record<AuditActorRole | 'ALL', number>;

export interface AuditPage {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuditStatsBucket {
  total: number;
  users: number;
  admins: number;
  system: number;
  security: number;
}

export interface AuditStats {
  current: AuditStatsBucket;
  previous: AuditStatsBucket | null;
}

export interface AuditRelated {
  items: Array<{ id: string; code: string; action: string; createdAt: string; reason: string | null; targetType: string | null; targetId: string | null; actor: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string } | null }>;
}

export interface AuditFilters {
  actorRole?: AuditActorRole | 'USERS';
  outcome?: 'SUCCESS' | 'FAILED';
  kind?: 'security';
  technical?: 'true';
  dir?: 'asc' | 'desc';
  actorNumber?: number;
  actorId?: string;
  action?: string;
  category?: string;
  targetType?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface AdminChatPerson {
  id: string;
  accountNumber: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email?: string | null;
  avatar?: string | null;
  status?: string;
  masterProfile?: { profession: string | null; ratingAvg: string; ratingCount: number } | null;
}

export interface AdminConversation {
  id: string;
  type: 'ORDER' | 'SUPPORT' | 'DIRECT';
  orderId: string | null;
  updatedAt: string;
  participants: Array<{ roles: string[]; deletedAt: string | null; user: AdminChatPerson }>;
  order: { id: string; status: string; orderNumber: number; finalAmount: string; currency: string; casesCount: number; category: string | null } | null;
  lastMessage: { text: string | null; createdAt: string; deletedAt: string | null; hasAttachments?: boolean } | null;
  messageCount: number;
  deletedCount: number;
  editedCount: number;
}

export interface AdminConversationDetail extends Omit<AdminConversation, 'order' | 'lastMessage' | 'messageCount' | 'deletedCount' | 'editedCount' | 'participants'> {
  createdAt: string;
  participants: Array<{ roles: string[]; deletedAt: string | null; lastReadAt: string | null; joinedAt: string; user: AdminChatPerson }>;
  order: {
    id: string;
    status: string;
    orderNumber: number;
    finalAmount: string;
    currency: string;
    createdAt: string;
    title: string;
    category: string | null;
    city: string | null;
    district: string | null;
    cases: Array<{ id: string; type: string; title: string; status: string; createdAt: string }>;
    payment: { provider: string; status: string } | null;
  } | null;
}

export interface AdminConversationStats {
  total: number;
  order: number;
  direct: number;
  support: number;
  disputed: number;
  withDeleted: number;
  withEdited: number;
  messages: number;
}

export interface AdminConversationFile {
  mediaAssetId: string;
  mimeType: string;
  name: string;
  messageId: string;
  createdAt: string;
  messageDeletedAt: string | null;
  sender: AdminChatPerson;
}

export interface AdminConversationEvent {
  id: string;
  kind: 'created' | 'first_message' | 'deleted' | 'edited' | 'call' | 'order_status';
  at: string;
  actor: AdminChatPerson | null;
  detail: Record<string, unknown>;
}

export interface AdminConversationFilters {
  search?: string;
  type?: string;
  orderStatus?: string;
  flag?: 'deleted' | 'edited' | 'files' | 'disputed';
  sort?: 'recent' | 'oldest' | 'messages';
}

export interface AdminChatMessage {
  id: string;
  senderId: string;
  senderPanel: string | null;
  type: string;
  text: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: AdminChatPerson;
  attachments?: Array<{ mediaAssetId: string; mimeType: string; name: string }> | null;
  replyTo?: { id: string; text: string | null; deletedAt: string | null } | null;
  reactions?: Array<{ emoji: string; userId?: string; panel?: string; createdAt?: string }>;
  edits: Array<{ id: string; previousText: string | null; editedAt: string }>;
}

export type { CaseStatus };

export type AdminOrderStatus =
  | 'DRAFT' | 'SUBMITTED' | 'MATCHING' | 'OFFERS_RECEIVED' | 'BOOKED' | 'CONFIRMED' | 'ON_THE_WAY' | 'ARRIVED'
  | 'IN_PROGRESS' | 'WAITING_CONFIRMATION' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'DISPUTED';

export interface AdminOrderPerson {
  id: string;
  accountNumber: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  avatar?: string | null;
}

export interface AdminOrderRow {
  id: string;
  orderNumber: number;
  status: AdminOrderStatus;
  finalAmount: string;
  currency: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  title: string;
  category?: { id: string; name: string } | null;
  city?: string | null;
  district?: string | null;
  originalAmount?: string;
  additionalAmount?: string;
  platformFee?: string | null;
  scheduledStartAt: string | null;
  customer: AdminOrderPerson;
  master: { id: string; profession: string | null; ratingAvg?: string; ratingCount?: number; user: AdminOrderPerson };
  payment: { provider: PaymentProvider; status: PaymentStatus } | null;
  _count: { workProofs: number; cases: number; payments: number };
}

export interface AdminOrdersSummary {
  total: number;
  counts: Partial<Record<AdminOrderStatus, number>>;
  active: number;
  flagged: number;
  completedAmount: string | number;
  platformFee: string | number;
  weekAgoTotal: number;
  trends: Record<'created' | 'active' | 'flagged' | 'completed' | 'amount', { current: number; previous: number; changePercent: number | null }>;
}

export interface AdminOrdersPage {
  items: AdminOrderRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminOrderFacets {
  categories: Array<{ id: string; name: string; count: number }>;
  cities: Array<{ name: string; count: number }>;
}

export interface AdminOrderFilters {
  status?: AdminOrderStatus;
  search?: string;
  from?: string;
  to?: string;
  flagged?: 'true';
  ongoing?: 'true';
  payment?: PaymentStatus | 'NONE';
  category?: string;
  city?: string;
  sort?: 'createdAt' | 'amount';
  dir?: 'asc' | 'desc';
}

export interface AdminMediaInfo {
  id: string;
  originalName: string;
  detectedMimeType: string | null;
  sizeBytes: number | string;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: number;
  /** Mijozning va ustaning nechanchi buyurtmasi ekani (foydalanuvchilarga ko‘rinadigan raqam). */
  customerOrderIndex: number;
  masterOrderIndex: number;
  status: AdminOrderStatus;
  originalAmount: string;
  additionalAmount: string;
  finalAmount: string;
  platformFee: string | null;
  masterAmount: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completionSubmittedAt: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  customer: AdminOrderPerson;
  master: { id: string; profession: string | null; ratingAvg: string; completedOrders: number; user: AdminOrderPerson };
  booking: {
    scheduledStartAt: string | null;
    scheduledEndAt: string | null;
    agreedPrice: string;
    locationSnapshot: Record<string, unknown> | null;
    serviceSnapshot: Record<string, unknown> | null;
    request: {
      id: string;
      title: string;
      description: string;
      status: string;
      createdAt: string;
      preferredStartAt: string | null;
      preferredEndAt: string | null;
      category: { name: string } | null;
      address: { addressLine: string; city: string | null; district: string | null } | null;
    };
    offer: { id: string; price: string; message: string | null; estimatedMinutes: number | null; createdAt: string };
  };
  statusHistory: Array<{ id: string; actorType: string; oldStatus: AdminOrderStatus | null; newStatus: AdminOrderStatus; reason: string | null; createdAt: string; actor: AdminOrderPerson | null }>;
  workProofs: Array<{ id: string; stage: 'BEFORE' | 'DURING' | 'AFTER'; mediaType: string; mediaAssetId: string | null; createdAt: string; uploadedBy: AdminOrderPerson; asset: AdminMediaInfo | null }>;
  additionalWork: Array<{ id: string; reason: string; description: string; amount: string; currency: string; status: string; requestedAt: string; respondedAt: string | null; requestedBy: AdminOrderPerson }>;
  payments: Array<{ id: string; provider: string; amount: string; refundedAmount: string; currency: string; status: string; failureReason: string | null; createdAt: string; succeededAt: string | null; refunds: Array<{ id: string; amount: string; status: string; reason: string }> }>;
  review: { id: string; rating: number; comment: string | null; status: string; createdAt: string; author: AdminOrderPerson } | null;
  warranty: { id: string; status: string; startsAt: string; expiresAt: string } | null;
  cases: Array<{ id: string; type: string; title: string; status: string; createdAt: string }>;
  requestAssets: AdminMediaInfo[];
  conversationId: string | null;
  allowedActions: { cancel: boolean; resolve: boolean };
}

/** Admin akkaunti (superadmin ko‘radigan «Adminlar» ro‘yxati). */
export interface AdminAccount {
  id: string;
  accountNumber: number;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
  phoneVerifiedAt?: string | null;
  activeDevices?: number;
  avatar?: string | null;
  adminAvatarAllowed?: boolean;
  status: ManagedStatus;
  isSuperAdmin: boolean;
  adminPermissions?: string[];
  /** Superadmin belgilagan: bu admin yangi adminlar yarata oladimi va qaysi huquqlarni bera oladi. */
  canCreateAdmins?: boolean;
  grantablePermissions?: string[];
  createdByAdminId?: string | null;
  isSelf?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface AdminAccountsStats {
  total: number;
  totalWeekAgo: number;
  active: number;
  blocked: number;
  suspended: number;
  pending: number;
  mfaOn: number;
  mfaOff: number;
  superAdmins: number;
}

export interface AdminAccountDetails {
  sessions: Array<{ id: string; status: 'ACTIVE' | 'REVOKED' | string; panel: string | null; ipAddress: string | null; userAgent: string | null; lastSeenAt: string; createdAt: string; revokedAt: string | null }>;
  activity: Array<{ id: string; action: string; targetType: string | null; reason: string | null; createdAt: string }>;
  actions30d: number;
  passwordResetAt: string | null;
  createdBy: { accountNumber: number; firstName: string | null; lastName: string | null } | null;
}

export interface CreateAdminInput {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  canCreateAdmins?: boolean;
  grantablePermissions?: string[];
}

/** Joriy adminning adminlarni boshqarish doirasi (server qaytaradi). */
export interface AdminScope {
  superAdmin: boolean;
  grantable: string[];
}
