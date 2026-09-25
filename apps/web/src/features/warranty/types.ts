export type WarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface Warranty {
  id: string;
  orderId: string;
  startsAt: string;
  expiresAt: string;
  conditions: string | null;
  status: WarrantyStatus;
}

export interface WarrantyClaimInput {
  reason: string;
  description: string;
}
