import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

const state = { isLoading: false };
vi.mock('../hooks/useServices', () => ({
  useServiceCategories: () => ({
    isLoading: state.isLoading,
    data: state.isLoading
      ? undefined
      : [
          { id: 'c1', name: 'Santexnika', services: [{ id: 's1', name: 'Kran va armatura ta’miri' }, { id: 's2', name: 'Quvur almashtirish' }] },
          { id: 'c2', name: 'Elektrika', services: [{ id: 's3', name: 'Rozetka o‘rnatish' }] },
          { id: 'c3', name: 'Bo‘sh kategoriya', services: [] },
        ],
  }),
}));

import { ServiceChooser } from './ServiceChooser';

function Harness({ error }: { error?: string }) {
  const [value, setValue] = useState('');
  return <ServiceChooser label="Xizmat turi" value={value} onChange={setValue} required error={error} />;
}

describe('ServiceChooser', () => {
  it('lists every service with category chips (empty categories are hidden)', () => {
    state.isLoading = false;
    render(<Harness />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Santexnika/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Elektrika/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bo‘sh kategoriya/ })).not.toBeInTheDocument();
  });

  it('filters by category chip and by search text', async () => {
    state.isLoading = false;
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /Elektrika/ }));
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /Rozetka/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hammasi' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Xizmat qidirish' }), 'quvur');
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /Quvur almashtirish/ })).toBeInTheDocument();

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'yo‘q narsa');
    expect(screen.getByText('Hech narsa topilmadi')).toBeInTheDocument();
  });

  it('selects one service at a time and confirms the choice', async () => {
    state.isLoading = false;
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: /Kran va armatura/ }));
    expect(screen.getByRole('radio', { name: /Kran va armatura/ })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Kran va armatura ta’miri');

    await userEvent.click(screen.getByRole('radio', { name: /Rozetka/ }));
    expect(screen.getByRole('radio', { name: /Kran va armatura/ })).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Rozetka o‘rnatish');
  });

  it('shows validation errors and a loading skeleton', () => {
    state.isLoading = false;
    const { unmount } = render(<Harness error="Xizmat turini tanlang" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Xizmat turini tanlang');
    unmount();
    state.isLoading = true;
    const { container } = render(<Harness />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
