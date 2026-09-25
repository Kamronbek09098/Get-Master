export type ReviewStatus = 'PUBLISHED' | 'FLAGGED' | 'HIDDEN' | 'REMOVED';

export interface Review {
  id: string;
  orderId: string;
  authorId: string;
  masterProfileId: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
}

export interface CreateReviewInput {
  orderId: string;
  rating: number;
  comment?: string;
}
