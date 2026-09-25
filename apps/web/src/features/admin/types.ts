import type { CaseStatus } from '@/features/dispute/types';
import type { MasterVerificationStatus } from '@/features/master/types';

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
  role?: 'CUSTOMER' | 'MASTER';
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
  recentActivity: Array<{ id: string; action: string; reason: string | null; actorId: string | null; createdAt: string }>;
}

export interface AdminBadges {
  verifications: number;
  cases: number;
  appeals: number;
  users: number;
  chats: number;
  now: string;
}

export interface AuditFilters {
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
  participants: Array<{ roles: string[]; user: AdminChatPerson }>;
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
  reactions?: Array<{ emoji: string }>;
  edits: Array<{ id: string; previousText: string | null; editedAt: string }>;
}

export type { CaseStatus };
