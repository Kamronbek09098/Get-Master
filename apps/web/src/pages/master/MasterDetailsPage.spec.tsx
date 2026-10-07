import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openChat = vi.fn();
vi.mock('@/features/master/hooks/useMaster', () => ({
  useMaster: () => ({
    isLoading: false,
    isError: false,
    data: {
      id: 'm1',
      profession: 'Elektrik',
      bio: 'Uy elektr ishlari',
      experienceYears: 5,
      ratingAvg: '4.8',
      ratingCount: 12,
      completedOrders: 30,
      verification: 'VERIFIED',
      user: { firstName: 'Aziz', lastName: 'Rahimov' },
    },
  }),
}));
vi.mock('@/features/communication/hooks/useCommunication', () => ({
  useOpenMasterChat: () => ({ mutate: openChat, isPending: false, isError: false, error: null }),
}));
vi.mock('@/features/master/components/FavoriteButton', () => ({ FavoriteButton: () => <button type="button">Saqlash</button> }));
vi.mock('@/features/master/components/PublicAvailability', () => ({ PublicAvailability: () => null }));
vi.mock('@/features/master/components/PublicPortfolio', () => ({ PublicPortfolio: () => <p>portfolio</p> }));
vi.mock('@/features/master/components/CompletedJobs', () => ({ CompletedJobs: () => <p>sharhlar</p> }));

import { MasterDetailsPage } from './MasterDetailsPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/mijoz/ustalar/m1']}>
      <Routes>
        <Route path="/mijoz/ustalar/:id" element={<MasterDetailsPage />} />
        <Route path="/mijoz/chat" element={<p>chat sahifasi</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MasterDetailsPage chat button', () => {
  beforeEach(() => openChat.mockClear());

  it('shows the master and a “chat” button', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Aziz Rahimov' })).toBeInTheDocument();
    expect(screen.getByText('Elektrik')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat orqali bog‘lanish/ })).toBeInTheDocument();
  });

  it('opens a chat with this master and goes to the chat page with the conversation selected', async () => {
    openChat.mockImplementation((_id: string, options?: { onSuccess?: (c: { id: string }) => void }) => options?.onSuccess?.({ id: 'conv-9' }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Chat orqali bog‘lanish/ }));
    expect(openChat).toHaveBeenCalledWith('m1', expect.anything());
    expect(await screen.findByText('chat sahifasi')).toBeInTheDocument();
  });
});
