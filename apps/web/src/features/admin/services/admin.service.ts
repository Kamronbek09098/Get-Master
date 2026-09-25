import { apiDelete, apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { CaseItem, CaseStatus } from '@/features/dispute/types';
import type { ServiceCategory } from '@/features/service/types';
import type {
  AdminBadges,
  AdminUserDetail,
  AdminUser,
  AdminChatMessage,
  AdminConversation,
  AdminPortfolioItem,
  AdminVerification,
  AuditFilters,
  AuditLog,
  Dashboard,
  RevenueRow,
  RevenueSummary,
  UserFilters,
  VerificationDecision,
} from '../types';

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

export const adminService = {
  dashboard(range: DateRange) {
    return apiGet<Dashboard>(`/admin/dashboard${qs({ ...range })}`);
  },
  report(range: DateRange) {
    return apiGet<{ summary: RevenueSummary } & CursorPage<RevenueRow>>(`/admin/reports${qs({ ...range })}`);
  },
  users(filters: UserFilters, cursor?: string) {
    return apiGet<CursorPage<AdminUser>>(`/admin/users${qs({ ...filters, cursor, limit: '20' })}`);
  },
  setUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED', reason?: string) {
    return apiPatch<AdminUser>(`/admin/users/${id}/status`, { status, reason });
  },
  deleteUser(id: string, reason: string) {
    return apiPost<{ deleted: boolean }>(`/admin/users/${id}/delete`, { reason });
  },
  cases(kind: 'complaints' | 'disputes', status?: CaseStatus) {
    return apiGet<CursorPage<CaseItem>>(`/${kind}/admin/all${qs({ status })}`);
  },
  updateCase(kind: 'complaints' | 'disputes', id: string, status: CaseStatus, decision?: string) {
    return apiPatch<CaseItem>(`/${kind}/${id}/status`, { status, decision });
  },
  verifications(status?: string) {
    return apiGet<CursorPage<AdminVerification>>(`/trust/admin/verifications${qs({ status })}`);
  },
  portfolio() {
    return apiGet<CursorPage<AdminPortfolioItem>>('/admin/portfolio?limit=50');
  },
  reviewPortfolio(id: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    return apiPost<unknown>(`/admin/portfolio/${id}/review`, { decision, reason });
  },
  reviewVerification(id: string, decision: VerificationDecision, reason?: string) {
    return apiPost<unknown>(`/trust/admin/verifications/${id}/review`, { decision, reason });
  },
  conversations(filters: { search?: string; type?: string; cursor?: string }) {
    return apiGet<CursorPage<AdminConversation>>(`/admin/conversations${qs({ limit: '30', ...filters })}`);
  },
  conversation(id: string) {
    return apiGet<AdminConversation>(`/admin/conversations/${id}`);
  },
  conversationMessages(id: string, cursor?: string) {
    return apiGet<CursorPage<AdminChatMessage>>(`/admin/conversations/${id}/messages${qs({ limit: '50', cursor })}`);
  },
  user(id: string) {
    return apiGet<AdminUserDetail>(`/admin/users/${id}`);
  },
  badges(since: Record<string, string | undefined>) {
    return apiGet<AdminBadges>(`/admin/badges${qs(since)}`);
  },
  audit(filters: AuditFilters, cursor?: string) {
    return apiGet<CursorPage<AuditLog>>(`/audit-logs${qs({ limit: '30', ...filters, cursor })}`);
  },
  categories() {
    return apiGet<ServiceCategory[]>('/service-categories');
  },
  createCategory(input: { name: string; description?: string; sortOrder?: number }) {
    return apiPost<unknown>('/service-categories', input);
  },
  updateCategory(id: string, input: { name?: string; description?: string; isActive?: boolean }) {
    return apiPatch<unknown>(`/service-categories/${id}`, input);
  },
  removeCategory(id: string) {
    return apiDelete<unknown>(`/service-categories/${id}`);
  },
  createService(input: { categoryId: string; name: string; description?: string }) {
    return apiPost<unknown>('/services', input);
  },
  updateService(id: string, input: { name?: string; description?: string; isActive?: boolean }) {
    return apiPatch<unknown>(`/services/${id}`, input);
  },
  removeService(id: string) {
    return apiDelete<unknown>(`/services/${id}`);
  },
};
