export type MasterStatus = 'ACTIVE' | 'INACTIVE' | 'BUSY' | 'RESTRICTED' | 'SUSPENDED';
export type MasterVerificationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUESTED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export interface MasterProfile {
  id: string;
  userId: string;
  profession: string | null;
  bio: string | null;
  experienceYears: number | null;
  status: MasterStatus;
  verification: MasterVerificationStatus;
  ratingAvg: string;
  ratingCount: number;
  completedOrders: number;
  isPaused: boolean;
  pauseReason?: string | null;
  workRadiusKm?: string | number | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  serviceAreas?: string[] | null;
  completionRate?: string | number;
  responseRate?: string | number;
  reliabilityScore?: string | number;
  createdAt: string;
}

export interface PublicMaster {
  id: string;
  profession: string | null;
  bio: string | null;
  experienceYears: number | null;
  ratingAvg: string;
  ratingCount: number;
  completedOrders: number;
  verification: MasterVerificationStatus;
  user: { accountNumber?: number; firstName: string | null; lastName: string | null };
  services?: Array<{ serviceId: string; basePrice: string; service: { id: string; name: string } }>;
}

export interface MasterInput {
  workRadiusKm?: number;
  latitude?: number;
  longitude?: number;
  serviceAreas?: string[];
  firstName?: string;
  lastName?: string;
  profession: string;
  bio?: string;
  experienceYears?: number;
}
