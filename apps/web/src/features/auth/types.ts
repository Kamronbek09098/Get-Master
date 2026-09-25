export interface RegisterInput {
  phone: string;
  password: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface RegisterResult {
  userId: string;
  verificationRequired: true;
  developmentCode?: string;
  existingAccount?: boolean;
  accountNumber?: number;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export interface LoginResult {
  verificationRequired: true;
  developmentCode?: string;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
}

export interface VerifyOtpResult {
  userId: string;
  deviceId: string;
  sessionId: string;
}

export interface VerifyRegistrationResult {
  id: string;
  phone: string;
  status: string;
}

export type DeviceSessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface DeviceSession {
  id: string;
  status: DeviceSessionStatus;
  userAgent: string | null;
  ipAddress: string | null;
  panel: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  canRevoke: boolean;
  revokeLockedUntil: string | null;
}
