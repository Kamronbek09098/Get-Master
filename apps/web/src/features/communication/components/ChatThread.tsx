import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useMe } from '@/features/session/hooks/useMe';
import { useDeleteMessage, useEditMessage, useMessages, useReactMessage, useSendMessage } from '../hooks/useCommunication';
import { canEdit, isOwnMessage } from '../format';
import type { ChatMessage, Conversation } from '../types';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

/** Xabarlar ro‘yxati + yozish maydoni + tahrirlash/o‘chirish oqimlari. */
export function ChatThread({ conversation }: { conversation: Conversation }) {
  const me = useMe();
  const send = useSendMessage(conversation.id);
  const edit = useEditMessage(conversation.id);
  const remove = useDeleteMessage(conversation.id);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const react = useReactMessage(conversation.id);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);

  const messages = useMessages(conversation.id);
  const lastEditable = useMemo(
    () => (messages.data?.items ?? []).find((message) => isOwnMessage(message, me.data?.id) && canEdit(message)) ?? null,
    [messages.data, me.data?.id],
  );
  useEffect(() => {
    if (!editing) return;
    const target = document.getElementById(`msg-${editing.id}`);
    target?.classList.add('gm-msg--editing');
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return () => target?.classList.remove('gm-msg--editing');
  }, [editing]);

  const error = edit.error ?? remove.error;

  return (
    <>
      <MessageList
        conversation={conversation}
        meId={me.data?.id}
        onEdit={setEditing}
        onDelete={setDeleting}
        onRetry={(message) => send.mutate({ text: message.text ?? '', tempId: message.id, attachments: message.attachments ?? undefined })}
        onReply={(message) => {
          setEditing(null);
          setReplyTo(message);
        }}
        onReact={(message, emoji) => react.mutate({ messageId: message.id, emoji })}
      />
      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      <Composer
        conversationId={conversation.id}
        editing={editing}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={(text, attachments) => {
          send.mutate({ text, attachments, replyTo });
          setReplyTo(null);
        }}
        onEdit={(message, text) => edit.mutate({ messageId: message.id, text }, { onSuccess: () => setEditing(null) })}
        onCancelEdit={() => setEditing(null)}
        onEditLast={lastEditable ? () => setEditing(lastEditable) : undefined}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Xabarni o‘chirish"
        description="Xabar ikkala tomon uchun ham «o‘chirilgan» deb ko‘rinadi. Moderatsiya uchun administrator o‘chirilgan va tahrirlangan xabarlarni ko‘ra oladi."
        confirmLabel="O‘chirish"
        tone="danger"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
      />
    </>
  );
}
