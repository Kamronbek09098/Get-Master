import { apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type {
  Appeal,
  AppealStatus,
  Compensation,
  CreateCompensationInput,
  CreateUserActionInput,
  UserAction,
} from '../types';

type List<T> = T[] | CursorPage<T>;

export const safetyService = {
  myActions() {
    return apiGet<List<UserAction>>('/user-actions/me');
  },
  myAppeals() {
    return apiGet<List<Appeal>>('/appeals/me');
  },
  myCompensations() {
    return apiGet<List<Compensation>>('/compensations/me');
  },
  createAppeal(input: { reason: string; actionId?: string; caseId?: string }) {
    return apiPost<Appeal>('/appeals', input);
  },
  allActions(userId?: string) {
    return apiGet<List<UserAction>>(`/user-actions${userId ? `?userId=${userId}` : ''}`);
  },
  createAction(input: CreateUserActionInput) {
    return apiPost<UserAction>('/user-actions', input);
  },
  liftAction(id: string) {
    return apiPost<UserAction>(`/user-actions/${id}/lift`);
  },
  allAppeals() {
    return apiGet<List<Appeal>>('/appeals');
  },
  resolveAppeal(id: string, status: AppealStatus, decision?: string) {
    return apiPatch<Appeal>(`/appeals/${id}`, { status, decision });
  },
  createCompensation(input: CreateCompensationInput) {
    return apiPost<Compensation>('/compensations', input);
  },
};
