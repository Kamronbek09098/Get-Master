import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CaseStatus } from '@/features/dispute/types';
import { adminService } from '../services/admin.service';
import type { DateRange, ReportPaymentsParams } from '../services/admin.service';
import type { AdminConversationFilters, AdminOrderFilters, AuditFilters, CreateAdminInput, DevOpsWindow, UserFilters, VerificationDecision } from '../types';

export function useDashboard(range: DateRange) {
  return useQuery({ queryKey: ['admin', 'dashboard', range], queryFn: () => adminService.dashboard(range) });
}

export function useOrdersSeries(days: 7 | 30 | 90) {
  return useQuery({ queryKey: ['admin', 'orders-series', days], queryFn: () => adminService.ordersSeries(days), placeholderData: (previous) => previous });
}

export function useReportsOverview(range: DateRange) {
  return useQuery({ queryKey: ['admin', 'reports-overview', range], queryFn: () => adminService.reportsOverview(range), placeholderData: (previous) => previous });
}

export function useReportPayments(params: ReportPaymentsParams) {
  return useQuery({ queryKey: ['admin', 'reports-payments', params], queryFn: () => adminService.reportPayments(params), placeholderData: (previous) => previous });
}

export function useRevenueReport(range: DateRange) {
  return useQuery({ queryKey: ['admin', 'report', range], queryFn: () => adminService.report(range) });
}

export function useDevOps(window: DevOpsWindow) {
  return useQuery({
    queryKey: ['admin', 'devops', window],
    queryFn: () => adminService.devops(window),
    refetchInterval: 15_000,
  });
}

export function useAdminUsers(filters: UserFilters) {
  return useInfiniteQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: ({ pageParam }: { pageParam?: string }) => adminService.users(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useAdminUsersPage(filters: UserFilters, page: number) {
  return useQuery({ queryKey: ['admin', 'users', 'page', filters, page], queryFn: () => adminService.usersPage(filters, page), placeholderData: keepPreviousData });
}

export function useAdminUserStats() {
  return useQuery({ queryKey: ['admin', 'users', 'stats'], queryFn: () => adminService.userStats(), staleTime: 15_000 });
}

export function useBulkUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status, reason }: { ids: string[]; status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'; reason?: string }) => adminService.bulkUserStatus(ids, status, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user-number'] });
    },
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'; reason?: string }) =>
      adminService.setUserStatus(id, status, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user-number'] });
    },
  });
}

/** Faqat administrator: saqlangan parolni ko‘rsatadi (har bir ko‘rish auditga yoziladi). */
export function useSetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password, reason }: { id: string; password: string; reason?: string }) => adminService.setUserPassword(id, password, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetUserTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => adminService.setUserTwoFactor(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useSetRegistrationBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, blocked, reason }: { id: string; blocked: boolean; reason?: string }) => adminService.setRegistrationBlock(id, blocked, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminService.deleteUser(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user-number'] });
    },
  });
}

export function useAdminCases(kind: 'complaints' | 'disputes', status?: CaseStatus) {
  return useQuery({ queryKey: ['admin', 'cases', kind, status], queryFn: () => adminService.cases(kind, status) });
}

export function useUpdateCase(kind: 'complaints' | 'disputes') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, decision }: { id: string; status: CaseStatus; decision?: string }) =>
      adminService.updateCase(kind, id, status, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cases'] }),
  });
}

export function useAdminVerifications(status?: string) {
  return useQuery({ queryKey: ['admin', 'verifications', status], queryFn: () => adminService.verifications(status) });
}

export function useAdminVerificationHistory() {
  return useQuery({ queryKey: ['admin', 'verifications', 'history'], queryFn: () => adminService.verifications(undefined, true) });
}

export function useAdminPortfolio() {
  return useQuery({ queryKey: ['admin', 'portfolio'], queryFn: () => adminService.portfolio() });
}

export function useAdminPortfolioHistory() {
  return useQuery({ queryKey: ['admin', 'portfolio', 'history'], queryFn: () => adminService.portfolio(true) });
}

export function useReviewPortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'APPROVE' | 'REJECT'; reason?: string }) =>
      adminService.reviewPortfolio(id, decision, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'portfolio'] }),
  });
}

export function useReviewVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: VerificationDecision; reason?: string }) =>
      adminService.reviewVerification(id, decision, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
  });
}

export function useAdminConversations(filters: AdminConversationFilters) {
  return useInfiniteQuery({
    queryKey: ['admin', 'conversations', filters],
    queryFn: ({ pageParam }: { pageParam?: string }) => adminService.conversations(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
}

export function useAdminConversationStats() {
  return useQuery({ queryKey: ['admin', 'conversations-stats'], queryFn: () => adminService.conversationStats(), refetchInterval: 30_000 });
}

export function useAdminConversationFiles(id: string | null, enabled: boolean) {
  return useQuery({ queryKey: ['admin', 'conversation', id, 'files'], queryFn: () => adminService.conversationFiles(id ?? ''), enabled: !!id && enabled });
}

export function useAdminConversationTimeline(id: string | null, enabled: boolean) {
  return useQuery({ queryKey: ['admin', 'conversation', id, 'timeline'], queryFn: () => adminService.conversationTimeline(id ?? ''), enabled: !!id && enabled });
}

export function useAdminConversation(id: string | null) {
  return useQuery({ queryKey: ['admin', 'conversation', id], queryFn: () => adminService.conversation(id ?? ''), enabled: !!id });
}

export function useAdminConversationMessages(id: string | null) {
  return useInfiniteQuery({
    queryKey: ['admin', 'conversation', id, 'messages'],
    queryFn: ({ pageParam }: { pageParam?: string }) => adminService.conversationMessages(id ?? '', pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!id,
  });
}

export function useAuditLogs(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: ({ pageParam }: { pageParam?: string }) => adminService.audit(filters, pageParam),
    refetchInterval: 30_000,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useAdminCatalog() {
  return useQuery({ queryKey: ['admin', 'catalog'], queryFn: () => adminService.categories() });
}

export function useCatalogMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
  };
  return {
    createCategory: useMutation({ mutationFn: adminService.createCategory, onSuccess }),
    updateCategory: useMutation({
      mutationFn: (v: { id: string; input: { name?: string; description?: string; isActive?: boolean; modes?: string[] } }) =>
        adminService.updateCategory(v.id, v.input),
      onSuccess,
    }),
    removeCategory: useMutation({ mutationFn: adminService.removeCategory, onSuccess }),
    createService: useMutation({ mutationFn: adminService.createService, onSuccess }),
    removeService: useMutation({ mutationFn: adminService.removeService, onSuccess }),
  };
}

export function useRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; amount: number; reason: string; note: string; idempotencyKey: string }) => {
      const { paymentService } = await import('@/features/payment/services/payment.service');
      return paymentService.refund(v.id, { amount: v.amount, reason: v.reason, note: v.note }, v.idempotencyKey);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminService.user(id ?? ''), enabled: !!id });
}

export function useAdminOrders(filters: AdminOrderFilters) {
  return useInfiniteQuery({
    queryKey: ['admin', 'orders', filters],
    queryFn: ({ pageParam }: { pageParam?: string }) => adminService.orders(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
}

export function useAdminOrdersPage(filters: AdminOrderFilters, page: number, limit = 20) {
  return useQuery({ queryKey: ['admin', 'orders', 'page', filters, page, limit], queryFn: () => adminService.ordersPage(filters, page, limit), placeholderData: keepPreviousData, refetchInterval: 30_000 });
}

export function useAdminOrderFacets() {
  return useQuery({ queryKey: ['admin', 'orders-facets'], queryFn: () => adminService.orderFacets(), staleTime: 60_000 });
}

export function useBulkCancelOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) => adminService.bulkCancelOrders(ids, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useAdminOrdersSummary() {
  return useQuery({ queryKey: ['admin', 'orders-summary'], queryFn: () => adminService.ordersSummary(), refetchInterval: 30_000 });
}

export function useAdminOrder(id: string | undefined) {
  return useQuery({ queryKey: ['admin', 'order', id], queryFn: () => adminService.order(id ?? ''), enabled: !!id, refetchInterval: 30_000 });
}

export function useCancelOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => adminService.cancelOrder(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useResolveOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { decision: 'COMPLETE' | 'CANCEL'; reason: string }) => adminService.resolveOrder(id, input.decision, input.reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useAuditPage(filters: AuditFilters, page: number, limit: number) {
  return useQuery({ queryKey: ['admin', 'audit', 'page', filters, page, limit], queryFn: () => adminService.auditPage(filters, page, limit), placeholderData: keepPreviousData, refetchInterval: 30_000 });
}

export function useAuditStats(filters: AuditFilters) {
  const { actorRole: _ignored, ...rest } = filters;
  return useQuery({ queryKey: ['admin', 'audit-stats', rest], queryFn: () => adminService.auditStats(rest), refetchInterval: 30_000 });
}

export function useAuditRelated(id: string | null) {
  return useQuery({ queryKey: ['admin', 'audit-related', id], queryFn: () => adminService.auditRelated(id as string), enabled: !!id });
}

export function useAuditSummary(filters: AuditFilters) {
  const { actorRole: _ignored, ...rest } = filters;
  return useQuery({ queryKey: ['admin', 'audit-summary', rest], queryFn: () => adminService.auditSummary(rest), refetchInterval: 30_000 });
}

export function useAdminUserByNumber(accountNumber: number | null) {
  return useQuery({ queryKey: ['admin', 'user-number', accountNumber], queryFn: () => adminService.userByNumber(accountNumber as number), enabled: accountNumber !== null, retry: false });
}

/** Adminlar ro‘yxati (faqat superadmin). Kalit ['admin','users',…] ostida: foydalanuvchi amallari (muzlatish/o‘chirish/parol) ro‘yxatni avtomatik yangilaydi. */
export function useAdminAccounts(enabled = true) {
  return useQuery({ queryKey: ['admin', 'users', 'admins'], queryFn: () => adminService.admins(), enabled });
}

export function useAdminMyProfile() {
  return useQuery({ queryKey: ['admin', 'my-profile'], queryFn: () => adminService.myProfile(), refetchInterval: 60_000 });
}

export function useAdminAccountDetails(id: string | null) {
  return useQuery({ queryKey: ['admin', 'users', 'admin-details', id], queryFn: () => adminService.adminDetails(id as string), enabled: !!id });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdminInput) => adminService.createAdmin(input),
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetAdminDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, canCreateAdmins, grantablePermissions }: { id: string; canCreateAdmins: boolean; grantablePermissions: string[] }) => adminService.setAdminDelegation(id, canCreateAdmins, grantablePermissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetSuperAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => adminService.setSuperAdmin(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetAdminPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) => adminService.setAdminPermissions(id, permissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
