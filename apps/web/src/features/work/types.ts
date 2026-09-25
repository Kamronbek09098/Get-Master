export type AdditionalWorkStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface AdditionalWork {
  id: string;
  orderId: string;
  reason: string;
  description: string;
  amount: string;
  currency: string;
  status: AdditionalWorkStatus;
  requestedAt: string;
}

export interface CreateAdditionalWorkInput {
  reason: string;
  description: string;
  amount: number;
}
