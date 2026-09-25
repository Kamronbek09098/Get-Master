import { RequestStatus } from '@prisma/client';

export const OFFER_OPEN_STATUSES: readonly RequestStatus[] = ['SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'];

export const EDITABLE_STATUSES: readonly RequestStatus[] = ['DRAFT'];
export const CANCELLABLE_STATUSES: readonly RequestStatus[] = ['DRAFT', ...OFFER_OPEN_STATUSES];

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
