import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage, Conversation } from '../types';

const state: { conversations: Conversation[]; messages: ChatMessage[] } = { conversations: [], messages: [] };
const markAsRead = vi.fn();

vi.mock('../hooks/useCommunication', () => ({
  useConversations: () => ({ isLoading: false, isError: false, data: { items: state.conversations } }),
  useMessages: () => ({ isLoading: false, isError: false, data: { items: state.messages } }),
  useMarkRead: () => ({ mutate: markAsRead }),
  useDeleteConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/session/hooks/useMe', () => ({ useMe: () => ({ data: { id: 'me' } }) }));

import { ConversationList } from './ConversationList';
import { MessageList } from './MessageList';

const conversation = (over: Partial<Conversation>): Conversation => ({
  id: 'c1',
  type: 'DIRECT',
  orderId: null,
  order: null,
  counterpart: { id: 'u2', firstName: 'Aziz', lastName: 'Rahimov' },
  counterpartLastReadAt: null,
  lastMessage: null,
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
  ...over,
});

const message = (id: string, senderId: string, text: string, iso = new Date().toISOString(), over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  conversationId: 'c1',
  senderId,
  type: 'TEXT',
  text,
  createdAt: iso,
  editedAt: null,
  deleted: false,
  ...over,
});

beforeEach(() => {
  state.conversations = [];
  state.messages = [];
  markAsRead.mockClear();
  useAuthStore.setState({ preferredRole: null });
  Element.prototype.scrollTo = vi.fn();
});

describe('ConversationList', () => {
  it('points a customer to the masters catalog when there are no chats yet', () => {
    render(
      <MemoryRouter>
        <ConversationList selectedId={null} onSelect={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Suhbatlar hali yo‘q')).toBeInTheDocument();
    expect(screen.getByText(/Chat orqali bog‘lanish/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ustalarni ko‘rish' })).toHaveAttribute('href', '/mijoz/ustalar');
  });

  it('tells a master that chats appear when customers write', () => {
    useAuthStore.setState({ preferredRole: 'MASTER' });
    render(
      <MemoryRouter>
        <ConversationList selectedId={null} onSelect={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Mijozlar sizga yozganda/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ustalarni ko‘rish' })).not.toBeInTheDocument();
  });

  it('shows the counterpart, my own “Siz:” previews, unread badges, and selects on click', async () => {
    state.conversations = [
      conversation({ id: 'c1', unreadCount: 3, lastMessage: message('m1', 'u2', 'Ertaga boraman') }),
      conversation({ id: 'c2', counterpart: { id: 'u3', firstName: 'Jasur', lastName: null }, lastMessage: message('m2', 'me', 'Rahmat') }),
    ];
    const onSelect = vi.fn();
    render(<ConversationList selectedId="c1" onSelect={onSelect} />);
    expect(screen.getByText('Aziz Rahimov')).toBeInTheDocument();
    expect(screen.getByText('Ertaga boraman')).toBeInTheDocument();
    expect(screen.getByLabelText('3 ta o‘qilmagan')).toBeInTheDocument();
    expect(screen.getByText('Siz: Rahmat')).toBeInTheDocument();
    expect(screen.getByRole('button', { current: true })).toHaveTextContent('Aziz Rahimov');
    const [selectRow] = screen.getAllByRole('button', { name: /Jasur/ }).filter((btn) => !btn.hasAttribute('aria-label'));
    await userEvent.click(selectRow!);
    expect(onSelect).toHaveBeenCalledWith('c2');
  });

  it('filters by search text and by “unread only”', async () => {
    state.conversations = [
      conversation({ id: 'c1', unreadCount: 2, lastMessage: message('m1', 'u2', 'Narxi qancha') }),
      conversation({ id: 'c2', counterpart: { id: 'u3', firstName: 'Jasur', lastName: 'Karimov' }, lastMessage: message('m2', 'u3', 'Salom') }),
    ];
    render(<ConversationList selectedId={null} onSelect={() => undefined} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Suhbatlarni qidirish' }), 'jasur');
    const rows = screen.getAllByRole('button', { name: /Jasur|Aziz/ }).filter((btn) => !btn.hasAttribute('aria-label'));
    expect(rows).toHaveLength(1);
    expect(screen.getByText('Jasur Karimov')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.click(screen.getByRole('button', { name: /O‘qilmagan/ }));
    expect(screen.queryByText('Jasur Karimov')).not.toBeInTheDocument();
    expect(screen.getByText('Aziz Rahimov')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox'), 'yo‘q');
    expect(screen.getByText('Hech narsa topilmadi')).toBeInTheDocument();
  });

  it('shows a neutral placeholder instead of a generic role name when the counterpart has no name', () => {
    state.conversations = [conversation({ counterpart: { id: 'u2', accountNumber: 572, firstName: null, lastName: null } })];
    render(<ConversationList selectedId={null} onSelect={() => undefined} />);
    expect(screen.getByText('Ism kiritilmagan')).toBeInTheDocument();
    expect(screen.queryByText('Usta')).not.toBeInTheDocument();
  });
});

describe('MessageList', () => {
  const noop = () => undefined;

  it('renders day separators, my messages on the right, and marks the chat read', () => {
    state.messages = [
      message('m3', 'me', 'Ha, kelishdik', '2026-09-24T05:02:00Z'),
      message('m2', 'u2', 'Ertaga bo‘shman', '2026-09-24T05:01:00Z'),
      message('m1', 'me', 'Salom', '2026-09-23T10:00:00Z'),
    ];
    const { container } = render(<MessageList conversation={conversation({})} meId="me" onEdit={noop} onDelete={noop} onRetry={noop} />);
    expect(container.querySelectorAll('.gm-thread__day')).toHaveLength(2);
    const bubbles = [...container.querySelectorAll('.gm-msg')];
    expect(bubbles.map((el) => el.classList.contains('gm-msg--mine'))).toEqual([true, false, true]);
    expect(markAsRead).toHaveBeenCalled();
  });

  it('shows sent vs read ticks depending on when the other side last read', () => {
    state.messages = [message('m2', 'me', 'Ikkinchi', '2026-09-24T05:10:00Z'), message('m1', 'me', 'Birinchi', '2026-09-24T05:00:00Z')];
    render(
      <MessageList
        conversation={conversation({ counterpartLastReadAt: '2026-09-24T05:05:00Z' })}
        meId="me"
        onEdit={noop}
        onDelete={noop}
        onRetry={noop}
      />,
    );
    expect(screen.getAllByLabelText('O‘qildi')).toHaveLength(1);
    expect(screen.getAllByLabelText('Yuborildi')).toHaveLength(1);
  });

  it('shows pending and failed messages, and retries a failed one', async () => {
    const onRetry = vi.fn();
    state.messages = [
      message('tmp-2', 'me', 'Yuborilmadi', undefined, { status: 'failed' }),
      message('tmp-1', 'me', 'Kutilmoqda', undefined, { status: 'pending' }),
    ];
    render(<MessageList conversation={conversation({})} meId="me" onEdit={noop} onDelete={noop} onRetry={onRetry} />);
    expect(screen.getByLabelText('Yuborilmoqda')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /qayta urinish/ }));
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ id: 'tmp-2' }));
  });

  it('offers edit only on my own recent messages, delete on any (for me / for everyone)', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    state.messages = [message('m2', 'u2', 'Boshqaniki'), message('m1', 'me', 'Meniki')];
    render(<MessageList conversation={conversation({})} meId="me" onEdit={onEdit} onDelete={onDelete} onRetry={noop} />);
    const triggers = screen.getAllByRole('button', { name: 'Xabar amallari' });
    expect(triggers).toHaveLength(2);
    await userEvent.click(triggers[1]!);
    const others = screen.getByRole('menu');
    expect(within(others).queryByRole('menuitem', { name: /Tahrirlash/ })).not.toBeInTheDocument();
    expect(within(others).getByRole('menuitem', { name: /O‘chirish/ })).toBeInTheDocument(); // boshqaning xabari: faqat men uchun o‘chirish
    expect(within(others).getByRole('menuitem', { name: /Nusxalash/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getAllByRole('button', { name: 'Xabar amallari' })[0]!);
    const menu = screen.getByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Tahrirlash/ }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Xabar amallari' })[0]!);
    await userEvent.click(screen.getByRole('menuitem', { name: /O‘chirish/ }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });

  it('turns links into anchors and shows deleted messages as such', () => {
    state.messages = [message('m2', 'u2', 'X', undefined, { deleted: true, text: null }), message('m1', 'u2', 'Manzil https://example.com/a?b=1, rahmat')];
    render(<MessageList conversation={conversation({})} meId="me" onEdit={noop} onDelete={noop} onRetry={noop} />);
    const link = screen.getByRole('link', { name: 'https://example.com/a?b=1' });
    expect(link).toHaveAttribute('href', 'https://example.com/a?b=1');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText('Xabar o‘chirilgan')).toBeInTheDocument();
  });

  it('invites to start the conversation when it is empty', () => {
    render(<MessageList conversation={conversation({})} meId="me" onEdit={noop} onDelete={noop} onRetry={noop} />);
    expect(screen.getByText('Suhbatni boshlang')).toBeInTheDocument();
  });
});
