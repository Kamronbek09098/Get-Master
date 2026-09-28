import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CaseStatus } from '@/features/dispute/types';
import { adminService } from '../services/admin.service';
import type { DateRange } from '../services/admin.service';
import type { AdminOrderFilters, AuditFilters, DevOpsWindow, UserFilters, VerificationDecision } from '../types';

export function useDashboard(range: DateRange) {
  return useQuery({ queryKey: ['admin', 'dashboard', range], queryFn: () => adminService.dashboard(range) });
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

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'; reason?: string }) =>
      adminService.setUserStatus(id, status, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminService.deleteUser(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
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

export function useAdminPortfolio() {
  return useQuery({ queryKey: ['admin', 'portfolio'], queryFn: () => adminService.portfolio() });
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

export function useAdminConversations(filters: { search?: string; type?: string }) {
  return useQuery({ queryKey: ['admin', 'conversations', filters], queryFn: () => adminService.conversations(filters) });
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
      mutationFn: (v: { id: string; input: { name?: string; description?: string; isActive?: boolean } }) =>
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

export function useAuditSummary(filters: AuditFilters) {
  const { actorRole: _ignored, ...rest } = filters;
  return useQuery({ queryKey: ['admin', 'audit-summary', rest], queryFn: () => adminService.auditSummary(rest), refetchInterval: 30_000 });
}

export function useAdminUserByNumber(accountNumber: number | null) {
  return useQuery({ queryKey: ['admin', 'user-number', accountNumber], queryFn: () => adminService.userByNumber(accountNumber as number), enabled: accountNumber !== null, retry: false });
}
