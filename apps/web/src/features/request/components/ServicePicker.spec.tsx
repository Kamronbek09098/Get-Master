import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutate = vi.fn();
vi.mock('../hooks/useRequests', () => ({
  useSetRequestService: () => ({ mutate, isPending: false, isError: false, error: null }),
}));
vi.mock('@/features/service/hooks/useServices', () => ({
  useServiceCategories: () => ({
    isLoading: false,
    data: [
      { id: 'c1', name: 'Santexnika', services: [{ id: 's1', name: 'Kran ta’miri' }, { id: 's2', name: 'Quvur' }] },
      { id: 'c2', name: 'Bo‘sh kategoriya', services: [] },
    ],
  }),
}));

import { ServicePicker } from './ServicePicker';

describe('ServicePicker', () => {
  beforeEach(() => mutate.mockClear());

  it('explains why a service is needed and disables the action until one is chosen', () => {
    render(<ServicePicker requestId="r1" />);
    expect(screen.getByText('Xizmat turi tanlanmagan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ustalarni izlash' })).toBeDisabled();
  });

  it('starts the master search with the chosen service', async () => {
    render(<ServicePicker requestId="r1" />);
    await userEvent.click(screen.getByRole('radio', { name: /Kran ta’miri/ }));
    expect(screen.getByText(/Tanlandi:/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ustalarni izlash' }));
    expect(mutate).toHaveBeenCalledWith('s1');
  });
});
