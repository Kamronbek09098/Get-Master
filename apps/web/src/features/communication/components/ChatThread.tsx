import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useMe } from '@/features/session/hooks/useMe';
import { useAuthStore } from '@/store/auth.store';
import { env } from '@/lib/env';
import { accountName } from '@/lib/account-name';
import { DirectOrderDialog } from './DirectOrderDialog';
import { useDeleteMessage, useEditMessage, useMessages, useReactMessage, useSendMessage } from '../hooks/useCommunication';
import { canEdit, isOwnMessage } from '../format';
import type { ChatMessage, Conversation } from '../types';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { t } from '@/i18n';

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
  const [deleteForAll, setDeleteForAll] = useState(true);
  const [orderOpen, setOrderOpen] = useState(false);
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const isCustomerPanel = (env.appRole ?? preferredRole) === 'CUSTOMER';
  const isAdmin = (env.appRole ?? preferredRole) === 'ADMIN';
  // Administrator xabari: admin ruxsat bermaguncha foydalanuvchi javob yoza olmaydi (yozish maydoni, javob va reaksiya yo‘q).
  const readOnly = conversation.type === 'SUPPORT' && !isAdmin && !conversation.userCanReply;
  const canOrder = isCustomerPanel && !!conversation.counterpartIsMaster;

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
        onDelete={(message) => {
          setDeleteForAll(true);
          setDeleting(message);
        }}
        onRetry={(message) => send.mutate({ text: message.text ?? '', tempId: message.id, attachments: message.attachments ?? undefined })}
        onReply={
          readOnly
            ? undefined
            : (message) => {
                setEditing(null);
                setReplyTo(message);
              }
        }
        onReact={readOnly ? undefined : (message, emoji) => react.mutate({ messageId: message.id, emoji })}
      />
      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      {readOnly ? (
        <p className="gm-chat-readonly" role="note">
          <ShieldCheck size={16} aria-hidden="true" />{' '}{t('Bu Admin xabari. Hozircha javob yozish yopiq — Admin ruxsat bersa, yozishingiz mumkin bo‘ladi.')}</p>
      ) : (
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
        onOrder={canOrder ? () => setOrderOpen(true) : undefined}
      />
      )}
      {orderOpen && <DirectOrderDialog conversationId={conversation.id} masterName={accountName(conversation.counterpart)} onClose={() => setOrderOpen(false)} />}
      <ConfirmDialog
        open={!!deleting}
        title={t('Xabarni o‘chirish')}
        description={
          deleting && isOwnMessage(deleting, me.data?.id) && deleteForAll
            ? t('Xabar suhbatdan ikkala tomon uchun ham butunlay o‘chiriladi. Hech qanday iz qolmaydi.')
            : t('Xabar faqat sizning suhbatingizdan o‘chadi. Suhbatdosh uni ko‘rishda davom etadi.')
        }
        confirmLabel={t('O‘chirish')}
        tone="danger"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { id: deleting.id, forEveryone: isOwnMessage(deleting, me.data?.id) && deleteForAll },
            { onSettled: () => setDeleting(null) },
          )
        }
      >
        {deleting && isOwnMessage(deleting, me.data?.id) && (
          <label className="gm-delete-both">
            <input type="checkbox" checked={deleteForAll} onChange={(event) => setDeleteForAll(event.target.checked)} />
            <span>{accountName(conversation.counterpart)}{' '}{t('uchun ham o‘chirish')}</span>
          </label>
        )}
      </ConfirmDialog>
    </>
  );
}
