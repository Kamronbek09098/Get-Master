import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Search } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { getErrorMessage } from '@/lib/error-messages';
import { env } from '@/lib/env';
import { cx } from '@/lib/utils';
import { useMe } from '@/features/session/hooks/useMe';
import { useAuthStore } from '@/store/auth.store';
import { listTime, previewText } from '../format';
import { useConversations } from '../hooks/useCommunication';
import { counterpartName } from '../names';
import { ChatAvatar } from './ChatAvatar';

export function ConversationList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const conversations = useConversations();
  const me = useMe();
  const role = useAuthStore((state) => state.preferredRole);
  const [query, setQuery] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);

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
        <strong>Suhbatlar hali yo‘q</strong>
        <p>
          {asMaster
            ? 'Mijozlar sizga yozganda yoki buyurtma qabul qilinganda suhbat shu yerda paydo bo‘ladi.'
            : 'Ustani tanlab, «Chat orqali bog‘lanish» tugmasi bilan birinchi suhbatingizni boshlang.'}
        </p>
        {!asMaster && (
          <Link to="/ustalar-katalogi" className="gm-convos__blank-cta">
            Ustalarni ko‘rish
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="gm-convos__tools">
        <label className="gm-convos__search">
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Suhbatlarni qidirish" placeholder="Qidirish" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="gm-convos__filters" role="group" aria-label="Filtr">
          <button type="button" className={cx(!onlyUnread && 'is-active')} aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>
            Hammasi
          </button>
          <button type="button" className={cx(onlyUnread && 'is-active')} aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>
            O‘qilmagan{unreadTotal > 0 && <b>{unreadTotal}</b>}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="gm-convos__none">{onlyUnread && !query ? 'O‘qilmagan suhbat yo‘q' : 'Hech narsa topilmadi'}</p>
      ) : (
        <ul className="gm-convos">
          {visible.map((conversation) => {
            const name = counterpartName(conversation, role);
            const active = conversation.id === selectedId;
            const time = conversation.lastMessage?.createdAt ?? conversation.updatedAt;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={cx('gm-convo', active && 'gm-convo--active', conversation.unreadCount > 0 && 'gm-convo--unread')}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelect(conversation.id)}
                >
                  <ChatAvatar name={name} seed={conversation.counterpart?.id ?? conversation.id} />
                  <span className="gm-convo__body">
                    <span className="gm-convo__top">
                      <strong>{name}</strong>
                      <time dateTime={time}>{listTime(time)}</time>
                    </span>
                    <span className="gm-convo__bottom">
                      <span className="gm-convo__preview">{previewText(conversation, me.data?.id)}</span>
                      {conversation.unreadCount > 0 && (
                        <span className="gm-convo__badge" aria-label={`${conversation.unreadCount} ta o‘qilmagan`}>
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
