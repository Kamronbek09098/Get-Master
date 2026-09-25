import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../types';
import { Composer } from './Composer';

const onSend = vi.fn();
const onEdit = vi.fn();
const onCancelEdit = vi.fn();

const own: ChatMessage = {
  id: 'm1',
  conversationId: 'c1',
  senderId: 'me',
  type: 'TEXT',
  text: 'Eski matn',
  createdAt: new Date().toISOString(),
  editedAt: null,
  deleted: false,
};

function setup(props: { editing?: ChatMessage | null; id?: string } = {}) {
  return render(
    <Composer conversationId={props.id ?? 'c1'} editing={props.editing ?? null} onSend={onSend} onEdit={onEdit} onCancelEdit={onCancelEdit} />,
  );
}

describe('Composer', () => {
  beforeEach(() => {
    onSend.mockClear();
    onEdit.mockClear();
    onCancelEdit.mockClear();
  });

  it('sends on Enter (trimmed) and clears the field', async () => {
    setup({ id: 'send-1' });
    const input = screen.getByLabelText('Xabar');
    await userEvent.type(input, '  Salom  {Enter}');
    expect(onSend).toHaveBeenCalledWith('Salom');
    expect(input).toHaveValue('');
  });

  it('inserts a new line on Shift+Enter instead of sending', async () => {
    setup({ id: 'send-2' });
    await userEvent.type(screen.getByLabelText('Xabar'), 'bir{Shift>}{Enter}{/Shift}ikki');
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Xabar')).toHaveValue('bir\nikki');
  });

  it('disables the send button for empty text and ignores whitespace-only messages', async () => {
    setup({ id: 'send-3' });
    expect(screen.getByRole('button', { name: 'Yuborish' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Xabar'), '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('keeps an unsent draft per conversation', async () => {
    const first = setup({ id: 'draft-a' });
    await userEvent.type(screen.getByLabelText('Xabar'), 'yozib turibman');
    first.unmount();
    const other = setup({ id: 'draft-b' });
    expect(screen.getByLabelText('Xabar')).toHaveValue('');
    other.unmount();
    setup({ id: 'draft-a' });
    expect(screen.getByLabelText('Xabar')).toHaveValue('yozib turibman');
  });

  it('inserts an emoji from the picker', async () => {
    setup({ id: 'emoji-1' });
    await userEvent.click(screen.getByRole('button', { name: 'Emoji' }));
    await userEvent.click(screen.getByRole('option', { name: '👍' }));
    expect(screen.getByLabelText('Xabar')).toHaveValue('👍');
  });

  it('edits: pre-fills the old text, saves only real changes, and cancels with Escape', async () => {
    const { unmount } = setup({ editing: own, id: 'edit-1' });
    expect(screen.getByText('Xabarni tahrirlash')).toBeInTheDocument();
    const input = screen.getByLabelText('Xabar');
    expect(input).toHaveValue('Eski matn');
    await userEvent.clear(input);
    await userEvent.type(input, 'Yangi matn{Enter}');
    expect(onEdit).toHaveBeenCalledWith(own, 'Yangi matn');
    expect(onSend).not.toHaveBeenCalled();
    unmount();

    setup({ editing: own, id: 'edit-2' });
    await userEvent.type(screen.getByLabelText('Xabar'), '{Enter}');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onCancelEdit).toHaveBeenCalled();
    onCancelEdit.mockClear();
    await userEvent.type(screen.getByLabelText('Xabar'), 'x{Escape}');
    expect(onCancelEdit).toHaveBeenCalled();
  });
});
