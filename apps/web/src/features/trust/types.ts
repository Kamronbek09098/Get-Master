import type { MasterStatus, MasterVerificationStatus } from '@/features/master/types';

export type VerificationDocumentType = 'IDENTITY' | 'CERTIFICATE' | 'LICENSE' | 'OTHER';

export interface VerificationDocument {
  id: string;
  documentType: VerificationDocumentType;
  mediaAssetId: string | null;
  status: MasterVerificationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface TrustStatus {
  verification: MasterVerificationStatus;
  status: MasterStatus;
  documents: VerificationDocument[];
}

export interface SubmitVerificationInput {
  documentType: VerificationDocumentType;
  mediaAssetId: string;
}
