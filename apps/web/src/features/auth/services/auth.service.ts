import { apiGet, apiPost } from '@/services/api.client';
import { REQUIRED_POLICY_IDS } from '@/config/policies';
import type {
  DeviceSession,
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
  VerifyOtpInput,
  VerifyOtpResult,
  VerifyRegistrationResult,
} from '../types';

export const authService = {
  register(input: RegisterInput) {
    return apiPost<RegisterResult>('/auth/register', { ...input, acceptedPolicyIds: REQUIRED_POLICY_IDS });
  },
  verifyRegistration(phone: string, code: string) {
    return apiPost<VerifyRegistrationResult>('/auth/verify-registration', { phone, code });
  },
  login(input: LoginInput) {
    return apiPost<LoginResult>('/auth/login', input);
  },
  verifyOtp(input: VerifyOtpInput) {
    return apiPost<VerifyOtpResult>('/auth/verify-otp', input);
  },
  refresh() {
    return apiPost<{ userId: string; deviceId: string }>('/auth/refresh');
  },
  logout(allDevices: boolean) {
    return apiPost<{ signedOut: boolean; allDevices: boolean }>('/auth/logout', { allDevices });
  },
  listSessions() {
    return apiGet<DeviceSession[]>('/auth/sessions');
  },
  revokeSession(sessionId: string) {
    return apiPost<{ revoked: boolean }>(`/auth/sessions/${sessionId}/revoke`);
  },
  revokeOtherSessions() {
    return apiPost<{ revoked: number }>('/auth/sessions/revoke-others');
  },
};
