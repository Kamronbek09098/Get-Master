export interface Availability {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
}

export interface AvailabilityInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
}

export interface PortfolioItem {
  id: string;
  title: string | null;
  description: string | null;
  mediaAssetId: string | null;
  status: PortfolioStatus;
  rejectReason: string | null;
  createdAt: string;
}

export type PortfolioStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PortfolioInput {
  mediaAssetId: string;
  title?: string;
  description?: string;
}
