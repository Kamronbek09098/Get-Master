import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenRequest } from '../types';

const mutate = vi.fn();
vi.mock('../hooks/useOffers', () => ({
  useCreateOffer: () => ({ mutate, isPending: false, isError: false, error: null }),
}));

import { AcceptRequestDialog } from './AcceptRequestDialog';

const request: OpenRequest = {
  id: 'r1',
  title: 'Kran oqyapti',
  description: 'Oshxonada',
  status: 'SUBMITTED',
  preferredStartAt: null,
  preferredEndAt: null,
  expiresAt: '2026-09-25T10:00:00Z',
  createdAt: '2026-09-24T10:00:00Z',
  service: { id: 's1', name: 'Kran ta’miri' },
  category: null,
  offersCount: 2,
  myOffer: null,
  notified: false,
  suggested: { price: '100000.00', estimatedMinutes: 60 },
};

describe('AcceptRequestDialog', () => {
  beforeEach(() => mutate.mockClear());

  it('explains that accepting means sending an offer, and pre-fills the master’s own price and duration', () => {
    render(<AcceptRequestDialog request={request} onClose={() => undefined} />);
    expect(screen.getByText('So‘rovni qabul qilish')).toBeInTheDocument();
    expect(screen.getByText(/Taklifingiz mijozga yuboriladi/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Narx/)).toHaveValue('100 000');
    expect(screen.getByLabelText(/davomiylik/i)).toHaveValue('60');
    expect(screen.getByText('≈ 1 soat')).toBeInTheDocument();
  });

  it('sends the offer for this request with the (edited) price', async () => {
    const onClose = vi.fn();
    render(<AcceptRequestDialog request={request} onClose={onClose} />);
    const price = screen.getByLabelText(/Narx/);
    await userEvent.clear(price);
    await userEvent.type(price, '120000');
    await userEvent.click(screen.getByRole('button', { name: 'Qabul qilish va taklif yuborish' }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', price: 120000, estimatedMinutes: 60 }),
      expect.anything(),
    );
  });

  it('leaves the price empty (and the button disabled) when the master has no price for the service', () => {
    render(<AcceptRequestDialog request={{ ...request, suggested: null }} onClose={() => undefined} />);
    expect(screen.getByLabelText(/Narx/)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Qabul qilish va taklif yuborish' })).toBeDisabled();
  });
});
