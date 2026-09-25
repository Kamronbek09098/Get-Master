import { apiDelete, apiGet, apiPost } from '@/services/api.client';
import type { SubmitVerificationInput, TrustStatus, VerificationDocument } from '../types';

export const trustService = {
  getStatus() {
    return apiGet<TrustStatus>('/trust/status');
  },
  remove(id: string) {
    return apiDelete<{ deleted: boolean; verification: string }>(`/trust/verifications/${id}`);
  },
  submit(input: SubmitVerificationInput) {
    return apiPost<VerificationDocument>('/trust/verifications', input);
  },
};
