export type MatchingStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type MatchStatus = 'CANDIDATE' | 'NOTIFIED' | 'DECLINED' | 'EXPIRED' | 'REMOVED';

export interface MatchingRun {
  id: string;
  requestId: string;
  status: MatchingStatus;
  createdAt: string;
}

export interface MatchingResult {
  id: string;
  masterId: string;
  master?: { user: { accountNumber: number } };
  score: string | null;
  distanceKm: string | null;
  status: MatchStatus;
}

export interface MatchingResponse {
  run: MatchingRun | null;
  results: MatchingResult[];
}
