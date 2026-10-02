import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Search, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { getErrorMessage } from '@/lib/error-messages';
import { env } from '@/lib/env';
import { cx } from '@/lib/utils';
import { useMe } from '@/features/session/hooks/useMe';
import { useAuthStore } from '@/store/auth.store';
import { listTime, previewText } from '../format';
import { useConversations, useDeleteConversation } from '../hooks/useCommunication';
import { counterpartName } from '../names';
import { ChatAvatar } from './ChatAvatar';
import { t } from '@/i18n';

export function ConversationList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const conversations = useConversations();
  const me = useMe();
  const role = useAuthStore((state) => state.preferredRole);
  const [query, setQuery] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const deleteConversation = useDeleteConversation();
  const [toDelete, setToDelete] = useState<{ id: string; name: string; support: boolean } | null>(null);
  const isAdmin = (env.appRole ?? role) === 'ADMIN';
  const [forEveryone, setForEveryone] = useState(false);

  const items = useMemo(() => conversations.data?.items ?? [], [conversations.data]);
  const unreadTotal = items.filter((item) => item.unreadCount > 0).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (onlyUnread && item.unreadCount === 0) return false;
      if (!needle) return true;
      return (
        counterpartName(item, role).toLowerCase().includes(needle) ||
        (item.lastMessage?.text ?? '').toLowerCase().includes(needle)
      );
    });
  }, [items, query, onlyUnread, role]);

  if (conversations.isLoading) {
    return (
      <div className="gm-convos__loading" aria-busy="true">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="gm-convos__skeleton" />
        ))}
      </div>
    );
  }
  if (conversations.isError) return <Alert tone="danger">{getErrorMessage(conversations.error)}</Alert>;
  if (items.length === 0) {
    const asMaster = (env.appRole ?? role) === 'MASTER';
    return (
      <div className="gm-convos__blank">
        <span aria-hidden="true">
          <MessageCircle size={26} strokeWidth={1.6} />
        </span>
        <strong>{t('Suhbatlar hali yo‘q')}</strong>
        <p>
          {asMaster
            ? t('Mijozlar sizga yozganda yoki buyurtma qabul qilinganda suhbat shu yerda paydo bo‘ladi.')
            : t('Ustani tanlab, «Chat orqali bog‘lanish» tugmasi bilan birinchi suhbatingizni boshlang.')}
        </p>
        {!asMaster && (
          <Link to="/ustalar-katalogi" className="gm-convos__blank-cta">{t('Ustalarni ko‘rish')}</Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="gm-convos__tools">
        <label className="gm-convos__search">
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label={t('Suhbatlarni qidirish')} placeholder={t('Qidirish')} value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="gm-convos__filters" role="group" aria-label={t('Filtr')}>
          <button type="button" className={cx(!onlyUnread && 'is-active')} aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>{t('Hammasi')}</button>
          <button type="button" className={cx(onlyUnread && 'is-active')} aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>{t('O‘qilmagan')}{unreadTotal > 0 && <b>{unreadTotal}</b>}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="gm-convos__none">{onlyUnread && !query ? t('O‘qilmagan suhbat yo‘q') : t('Hech narsa topilmadi')}</p>
      ) : (
        <ul className="gm-convos">
          {visible.map((conversation) => {
            const name = counterpartName(conversation, role);
            const active = conversation.id === selectedId;
            const time = conversation.lastMessage?.createdAt ?? conversation.updatedAt;
            return (
              <li key={conversation.id} className="gm-convo-row">
                <button
                  type="button"
                  className={cx('gm-convo', active && 'gm-convo--active', conversation.unreadCount > 0 && 'gm-convo--unread')}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelect(conversation.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setToDelete({ id: conversation.id, name, support: conversation.type === 'SUPPORT' });
                  }}
                >
                  <ChatAvatar name={name} seed={conversation.counterpart?.id ?? conversation.id} admin={conversation.type === 'SUPPORT' && !isAdmin} />
                  <span className="gm-convo__body">
                    <span className="gm-convo__top">
                      <strong>{name}</strong>
                      <time dateTime={time}>{listTime(time)}</time>
                    </span>
                    <span className="gm-convo__bottom">
                      <span className="gm-convo__preview">{previewText(conversation, me.data?.id)}</span>
                      {conversation.unreadCount > 0 && (
                        <span className="gm-convo__badge" aria-label={t('{unreadCount} ta o‘qilmagan', { unreadCount: conversation.unreadCount })}>
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="gm-convo__delete"
                  aria-label={t('{name} bilan suhbatni o‘chirish', { name })}
                  onClick={(event) => {
                    event.stopPropagation();
                    setToDelete({ id: conversation.id, name, support: conversation.type === 'SUPPORT' });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('Suhbatni o‘chirish')}
        description={
          toDelete
            ? forEveryone
              ? t('{name} bilan butun yozishma ikkala tomon uchun ham butunlay o‘chiriladi. Buni qaytarib bo‘lmaydi, administrator ham ko‘ra olmaydi.', { name: toDelete.name })
              : t('{name} bilan suhbat faqat sizning ro‘yxatingizdan o‘chiriladi. U sizga yangi xabar yozsa, suhbat qaytadan paydo bo‘ladi.', { name: toDelete.name })
            : ''
        }
        confirmLabel={t('O‘chirish')}
        tone="danger"
        loading={deleteConversation.isPending}
        onCancel={() => {
          setToDelete(null);
          setForEveryone(false);
        }}
        onConfirm={() => {
          if (!toDelete) return;
          const id = toDelete.id;
          deleteConversation.mutate({ id, forEveryone }, {
            onSuccess: () => {
              if (id === selectedId) onSelect(null);
              setToDelete(null);
              setForEveryone(false);
            },
          });
        }}
      >
        {toDelete && (!toDelete.support || isAdmin) && (
          <label className="gm-delete-both">
            <input type="checkbox" checked={forEveryone} onChange={(event) => setForEveryone(event.target.checked)} />
            <span>{toDelete.name}{' '}{t('uchun ham o‘chirish')}</span>
          </label>
        )}
      </ConfirmDialog>
    </>
  );
}
