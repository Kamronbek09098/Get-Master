import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/media/hooks/useMedia', () => ({
  useMediaSignedUrl: (id: string) => ({ isLoading: false, isError: false, data: { url: `https://cdn.test/${id}.jpg` } }),
}));

import { OrderStory } from './OrderStory';
import type { OrderDetailsData, WorkProof } from '../types';

const base = {
  id: 'o1',
  orderNumber: 7,
  status: 'COMPLETED',
  finalAmount: '150000',
  currency: 'UZS',
  completedAt: '2026-10-02T10:00:00.000Z',
  confirmedAt: '2026-10-02T10:05:00.000Z',
  scheduledStartAt: null,
  viewerRole: 'CUSTOMER',
  service: { id: 's', name: 'Santexnika' },
  request: { id: 'r', title: 'Kran oqyapti', description: 'Oshxonadagi kran tinmay oqyapti' },
  counterpart: { id: 'm', firstName: 'Aziz', lastName: 'R.', profession: 'Santexnik' },
  review: { rating: 5, comment: 'Zo‘r ish', createdAt: '2026-10-02T11:00:00.000Z' },
} as unknown as OrderDetailsData;

const proof = (id: string, stage: WorkProof['stage']): WorkProof =>
  ({ id, orderId: 'o1', uploadedById: 'm', stage, storageKey: id, mediaType: 'IMAGE', mediaAssetId: `asset-${id}`, createdAt: '2026-10-02T09:00:00.000Z' }) as unknown as WorkProof;

describe('OrderStory', () => {
  it('shows the problem and the before/after comparison with a before/after comparison when both photos exist', () => {
    render(<OrderStory data={base} proofs={[proof('b', 'BEFORE'), proof('a', 'AFTER')]} loading={false} />);
    expect(screen.getByLabelText('Oldin va keyin rasmlarini taqqoslash')).toBeTruthy();
    expect(screen.getByText('Oshxonadagi kran tinmay oqyapti')).toBeTruthy();
  });

  it('shows designed empty states instead of blanks when no photos are uploaded yet', () => {
    render(<OrderStory data={{ ...base, status: 'ARRIVED', review: null } as OrderDetailsData} proofs={[]} loading={false} />);
    expect(screen.getByText(/suratga oladi/)).toBeTruthy();
    expect(screen.getByText(/natija surati/)).toBeTruthy();
  });

  it('shows only the problem before the master arrives and for cancelled orders; nothing without a description', () => {
    const { container, rerender } = render(<OrderStory data={{ ...base, status: 'BOOKED' } as OrderDetailsData} proofs={[]} loading={false} />);
    expect(screen.getByText('Oshxonadagi kran tinmay oqyapti')).toBeTruthy();
    expect(screen.queryByText(/suratga oladi/)).toBeNull();
    rerender(<OrderStory data={{ ...base, status: 'CANCELLED' } as OrderDetailsData} proofs={[]} loading={false} />);
    expect(screen.getByText('Oshxonadagi kran tinmay oqyapti')).toBeTruthy();
    expect(screen.queryByText(/suratga oladi/)).toBeNull();
    rerender(<OrderStory data={{ ...base, status: 'BOOKED', request: null } as unknown as OrderDetailsData} proofs={[]} loading={false} />);
    expect(container.firstChild).toBeNull();
  });
});
