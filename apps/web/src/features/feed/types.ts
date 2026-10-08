export type FeedTab = 'foryou' | 'following' | 'trend' | 'saved';
export type FeedKind = 'VIDEO' | 'BEFORE_AFTER' | 'PHOTO';

export interface FeedPost {
  id: string;
  kind: FeedKind;
  status: 'PUBLISHED' | 'HIDDEN';
  caption: string | null;
  tags: string[];
  createdAt: string;
  durationSec: number | null;
  counts: { views: number; likes: number; saves: number; comments: number; shares: number };
  viewer: { liked: boolean; saved: boolean; following: boolean; own: boolean };
  category: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
  media: { videoUrl: string | null; coverUrl: string | null; beforeUrl: string | null; afterUrl: string | null };
  master: {
    id: string;
    accountNumber: number;
    name: string;
    profession: string | null;
    ratingAvg: number;
    ratingCount: number;
    completedOrders: number;
    experienceYears: number | null;
    isPro: boolean;
    verified: boolean;
  };
}

export interface FeedPage {
  items: FeedPost[];
  nextCursor: string | null;
}

export interface FeedFilters {
  tab: FeedTab;
  category: string;
  q: string;
  master?: string;
}

export interface FeedComment {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
  author: string;
}

export interface CreatePostInput {
  kind: FeedKind;
  caption?: string;
  tags?: string[];
  categoryId?: string;
  serviceId?: string;
  videoAssetId?: string;
  coverAssetId?: string;
  beforeAssetId?: string;
  afterAssetId?: string;
  durationSec?: number;
}
