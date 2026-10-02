import { apiDelete, apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { CaseItem, CaseStatus } from '@/features/dispute/types';
import type { ServiceCategory } from '@/features/service/types';
import type {
  AdminBadges,
  AdminOrderDetail,
  AdminOrderFilters,
  AdminOrderRow,
  AdminOrdersSummary,
  AdminAccount,
  AdminUserDetail,
  AdminUser,
  CreateAdminInput,
  AdminChatMessage,
  AdminConversation,
  AdminPortfolioItem,
  AdminVerification,
  AuditFilters,
  AuditSummary,
  AuditLog,
  Dashboard,
  DevOpsSnapshot,
  DevOpsWindow,
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
  devops(window: DevOpsWindow) {
    return apiGet<DevOpsSnapshot>(`/admin/devops${qs({ window })}`);
  },
  users(filters: UserFilters, cursor?: string) {
    return apiGet<CursorPage<AdminUser>>(`/admin/users${qs({ ...filters, cursor, limit: '20' })}`);
  },
  setUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED', reason?: string) {
    return apiPatch<AdminUser>(`/admin/users/${id}/status`, { status, reason });
  },
  setUserPassword(id: string, password: string, reason?: string) {
    return apiPost<{ updated: boolean }>(`/admin/users/${id}/password`, { password, reason: reason || undefined });
  },
  setRegistrationBlock(id: string, blocked: boolean, reason?: string) {
    return apiPost<{ registrationBlocked: boolean }>(`/admin/users/${id}/${blocked ? 'registration-block' : 'registration-unblock'}`, { reason });
  },

  admins() {
    return apiGet<{ items: AdminAccount[] }>('/admin/admins');
  },
  createAdmin(input: CreateAdminInput) {
    return apiPost<AdminAccount>('/admin/admins', input);
  },
  setAdminPermissions(id: string, permissions: string[]) {
    return apiPatch<{ permissions: string[] }>(`/admin/admins/${id}/permissions`, { permissions });
  },
  setSuperAdmin(id: string, value: boolean) {
    return apiPatch<{ isSuperAdmin: boolean }>(`/admin/admins/${id}/super`, { value });
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
  verifications(status?: string, history = false) {
    return apiGet<CursorPage<AdminVerification>>(`/trust/admin/verifications${qs({ status, history: history ? 'true' : undefined, limit: history ? '50' : undefined })}`);
  },
  portfolio(history = false) {
    return apiGet<CursorPage<AdminPortfolioItem>>(`/admin/portfolio?limit=50${history ? '&history=true' : ''}`);
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
  orders(filters: AdminOrderFilters, cursor?: string) {
    return apiGet<CursorPage<AdminOrderRow>>(`/admin/orders${qs({ limit: '25', ...filters, cursor })}`);
  },
  ordersSummary() {
    return apiGet<AdminOrdersSummary>('/admin/orders/summary');
  },
  order(id: string) {
    return apiGet<AdminOrderDetail>(`/admin/orders/${id}`);
  },
  cancelOrder(id: string, reason: string) {
    return apiPost<unknown>(`/admin/orders/${id}/cancel`, { reason });
  },
  resolveOrder(id: string, decision: 'COMPLETE' | 'CANCEL', reason: string) {
    return apiPost<unknown>(`/admin/orders/${id}/resolve`, { decision, reason });
  },
  userByNumber(accountNumber: number) {
    return apiGet<AdminUserDetail>(`/admin/users/by-number/${accountNumber}`);
  },
  user(id: string) {
    return apiGet<AdminUserDetail>(`/admin/users/${id}`);
  },
  badges(since: Record<string, string | undefined>) {
    return apiGet<AdminBadges>(`/admin/badges${qs(since)}`);
  },
  audit(filters: AuditFilters, cursor?: string) {
    return apiGet<CursorPage<AuditLog>>(`/audit-logs${qs({ limit: '30', ...filters, actorNumber: filters.actorNumber ? String(filters.actorNumber) : undefined, cursor })}`);
  },
  auditSummary(filters: AuditFilters) {
    return apiGet<AuditSummary>(`/audit-logs/summary${qs({ ...filters, actorRole: undefined, actorNumber: filters.actorNumber ? String(filters.actorNumber) : undefined })}`);
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
