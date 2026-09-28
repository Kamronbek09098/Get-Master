import type { CaseStatus } from '@/features/dispute/types';
import type { MasterVerificationStatus } from '@/features/master/types';

export type DevOpsWindow = '1h' | '24h' | '7d';

export interface DevOpsIssue {
  level: 'warning' | 'danger';
  message: string;
}

export interface DevOpsPing {
  ok: boolean;
  latencyMs: number | null;
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
    pid: number;
    nodeVersion: string;
    uptimeSeconds: number;
    rssMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
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
  backup: { configured: boolean; message: string };
  traffic: Array<{ at: string; count: number }>;
}

export interface Dashboard {
  users: { total: number; byStatus: Record<string, number> };
  masters: { total: number; byStatus: Record<string, number>; byVerification: Record<string, number> };
  requests: { total: number; byStatus: Record<string, number> };
  bookings: { total: number };
  orders: { total: number; byStatus: Record<string, number> };
  payments: { byStatus: Record<string, unknown> };
  disputes: { total: number; byStatus: Record<string, number> };
  reviews: { total: number; averageRating: number | string };
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

export interface AdminUser {
  id: string;
  accountNumber: number;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: ManagedStatus;
  createdAt: string;
  deletedAt: string | null;
  roles: Array<'CUSTOMER' | 'MASTER' | 'ADMIN'>;
  masterProfile: {
    id: string;
    profession: string | null;
    status: string;
    verification: MasterVerificationStatus;
    ratingAvg: string;
    completedOrders: number;
  } | null;
}

export interface UserFilters {
  role?: 'CUSTOMER' | 'MASTER' | 'ADMIN';
  status?: ManagedStatus;
  search?: string;
}

export interface AdminVerification {
  id: string;
  masterId: string;
  documentType: string;
  mediaAssetId: string | null;
  status: MasterVerificationStatus;
  rejectionReason: string | null;
  createdAt: string;
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
  rejectReason: string | null;
  createdAt: string;
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
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  deletedAt: string | null;
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
  recentActivity: Array<{ id: string; action: string; reason: string | null; actorId: string | null; actor?: { accountNumber: number } | null; createdAt: string }>;
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

export interface AuditFilters {
  actorRole?: AuditActorRole;
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
}

export interface AdminConversation {
  id: string;
  type: 'ORDER' | 'SUPPORT' | 'DIRECT';
  orderId: string | null;
  updatedAt: string;
  participants: Array<{ roles: string[]; deletedAt: string | null; user: AdminChatPerson }>;
  order: { id: string; status: string } | null;
  lastMessage: { text: string | null; createdAt: string; deletedAt: string | null } | null;
  messageCount: number;
  deletedCount: number;
  editedCount: number;
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
  scheduledStartAt: string | null;
  customer: AdminOrderPerson;
  master: { id: string; profession: string | null; user: AdminOrderPerson };
  _count: { workProofs: number; cases: number; payments: number };
}

export interface AdminOrdersSummary {
  total: number;
  counts: Partial<Record<AdminOrderStatus, number>>;
  active: number;
  flagged: number;
  completedAmount: string | number;
  platformFee: string | number;
}

export interface AdminOrderFilters {
  status?: AdminOrderStatus;
  search?: string;
  from?: string;
  to?: string;
  flagged?: 'true';
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
