export type MasterStatus = 'ACTIVE' | 'INACTIVE' | 'BUSY' | 'RESTRICTED' | 'SUSPENDED';
export type MasterVerificationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUESTED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'INACTIVE';

export interface MasterProfile {
  id: string;
  userId: string;
  profession: string | null;
  /** Ish joyi: ish xona, kompaniya yoki muassasa nomi. */
  workPlace?: string | null;
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
  workPlace?: string | null;
  bio: string | null;
  experienceYears: number | null;
  ratingAvg: string;
  ratingCount: number;
  completedOrders: number;
  verification: MasterVerificationStatus;
  /** Usta vaqtincha buyurtma qabul qilmayapti (pauza). */
  /** «Pro» obunali usta (oltin galochka, katalogda yuqori o‘rin). */
  isPro?: boolean;
  isPaused?: boolean;
  pausedUntil?: string | null;
  /** Javob berish ko‘rsatkichi (0–100). */
  responseRate?: string | number | null;
  /** Eng yaqin bo‘sh vaqt (ish jadvali bo‘lsa): dayOffset 0 — bugun, 1 — ertaga. */
  nextAvailable?: { dayOffset: number; time: string; now: boolean } | null;
  user: { accountNumber?: number; firstName: string | null; lastName: string | null };
  workRadiusKm?: string | number | null;
  serviceAreas?: string[] | null;
  /** Ish hududi: yaxlitlangan markaz (~1 km) va radius. */
  coverage?: { lat: number; lon: number; radiusKm: number } | null;
  services?: Array<{ serviceId: string; basePrice: string; service: { id: string; name: string } }>;
  /** Admin tasdiqlagan portfolio. `beforeMediaAssetId` bo‘lsa — oldin/keyin juftligi. */
  portfolio?: PublicPortfolioItem[];
}

export interface PublicPortfolioItem {
  id: string;
  title: string | null;
  description: string | null;
  mediaAssetId: string | null;
  beforeMediaAssetId: string | null;
  createdAt: string;
}

/** Ustaning ommaviy ish jadvali (faqat ochiq oynalar). */
export interface PublicAvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface MasterInput {
  workRadiusKm?: number;
  latitude?: number;
  longitude?: number;
  serviceAreas?: string[];
  firstName?: string;
  lastName?: string;
  profession: string;
  workPlace?: string;
  bio?: string;
  experienceYears?: number;
}

/** Mijoz manziliga kela oladigan usta. */
export interface CoveringMaster extends PublicMaster {
  distanceKm: number;
}

/** Ustaning yakunlangan ishlari natijasi: baholar taqsimoti va oxirgi ishlar. */
export interface PublicCompletedJobs {
  summary: { reviews: number; average: number | null; distribution: Record<'1' | '2' | '3' | '4' | '5', number> };
  items: Array<{
    id: string;
    title: string;
    completedAt: string | null;
    review: { rating: number; comment: string | null; authorName: string | null } | null;
  }>;
}
