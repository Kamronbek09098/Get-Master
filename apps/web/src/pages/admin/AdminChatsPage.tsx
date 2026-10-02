import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessagesSquare, Pencil, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { useDebounce } from '@/hooks/useDebounce';
import { cx, formatDate, formatDateTime, formatRelativeTime, initials } from '@/lib/utils';
import { avatarTone } from '@/features/communication/format';
import { STATUS_TEXT } from '@/features/order/order-flow';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { AccountLink } from '@/features/admin/components/AccountLink';
import { useAdminConversation, useAdminConversationMessages, useAdminConversations } from '@/features/admin/hooks/useAdmin';
import type { AdminChatMessage, AdminChatPerson, AdminConversation } from '@/features/admin/types';
import './AdminChatsPage.css';
import { t } from '@/i18n';

const TYPE_LABEL = { ORDER: t('Buyurtma'), DIRECT: t('To‘g‘ridan-to‘g‘ri'), SUPPORT: t('Yordam') } as const;
const TYPE_FILTERS = [
  { value: '', label: t('Hammasi') },
  { value: 'DIRECT', label: t('To‘g‘ridan-to‘g‘ri') },
  { value: 'ORDER', label: t('Buyurtma') },
];
const PANEL_LABEL: Record<string, string> = { CUSTOMER: 'mijoz', MASTER: 'usta', ADMIN: 'admin' };
const ROLE_LABEL: Record<string, string> = { CUSTOMER: 'mijoz', MASTER: 'usta', ADMIN: 'admin' };
const timeOf = (value: string) => formatDateTime(value).split(', ')[1] ?? '';
const dayKey = (value: string) => value.slice(0, 10);
const MSG_FILTERS = [
  { value: 'all', label: t('Hammasi') },
  { value: 'deleted', label: t('O‘chirilgan') },
  { value: 'edited', label: t('Tahrirlangan') },
  { value: 'files', label: t('Fayllar') },
] as const;
type MsgFilter = (typeof MSG_FILTERS)[number]['value'];

function ConversationRow({ item, active, onSelect }: { item: AdminConversation; active: boolean; onSelect: () => void }) {
  const names = item.participants.map((p) => accountName(p.user)).join(' ↔ ');
  const last = item.lastMessage;
  const preview = !last ? t('Xabar yo‘q') : last.deletedAt ? t('🗑 O‘chirilgan xabar') : (last.text ?? t('📎 Fayl'));
  const deletedBy = item.participants.filter((p) => p.deletedAt);
  return (
    <button type="button" className={cx('gm-achat__row', active && 'gm-achat__row--active')} onClick={onSelect} aria-current={active ? 'true' : undefined}>
      <ChatAvatar name={accountName(item.participants[0]?.user)} seed={item.id} />
      <span className="gm-achat__row-body">
        <span className="gm-achat__row-top">
          <strong>{names}</strong>
          <time className="gm-achat__row-time">{formatRelativeTime(item.updatedAt)}</time>
        </span>
        <span className={cx('gm-achat__row-preview', last?.deletedAt && 'gm-achat__row-preview--deleted')}>{preview}</span>
        <span className="gm-achat__row-flags">
          <Badge tone="neutral">{TYPE_LABEL[item.type]}</Badge>
          <small>{item.messageCount} xabar</small>
          {item.deletedCount > 0 && (
            <Badge tone="danger">
              <Trash2 size={11} /> {item.deletedCount}
            </Badge>
          )}
          {item.editedCount > 0 && (
            <Badge tone="warning">
              <Pencil size={11} /> {item.editedCount}
            </Badge>
          )}
          {deletedBy.length > 0 && (
            <span title={t('{join} ro‘yxatidan o‘chirgan (xabarlar saqlangan)', { join: deletedBy.map((p) => accountName(p.user)).join(', ') })}>
              <Badge tone="neutral">
                <Trash2 size={11} />{' '}{t('{join} o‘chirgan', { join: deletedBy.map((p) => accountName(p.user)).join(', ') })}</Badge>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

const senderColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 55% 38%)`;
};
const GROUP_GAP_MS = 5 * 60 * 1000;

/** Telegramdagi kabi: emoji + kim bosgani (kichik avatarlar), ustiga borsa ismlari chiqadi. */
function Reactions({ message, people }: { message: AdminChatMessage; people: Map<string, AdminChatPerson> }) {
  const groups = useMemo(() => {
    const byEmoji = new Map<string, NonNullable<AdminChatMessage['reactions']>>();
    for (const reaction of message.reactions ?? []) byEmoji.set(reaction.emoji, [...(byEmoji.get(reaction.emoji) ?? []), reaction]);
    return [...byEmoji.entries()];
  }, [message.reactions]);
  if (groups.length === 0) return null;
  return (
    <div className="gm-tg__reactions" aria-label={t('Reaksiyalar')}>
      {groups.map(([emoji, list]) => {
        const names = list.map((reaction) => {
          const user = reaction.userId ? people.get(reaction.userId) : undefined;
          const role = reaction.panel ? (PANEL_LABEL[reaction.panel] ?? reaction.panel) : null;
          return `${user ? accountName(user) : t('Noma‘lum')}${role ? ` (${role})` : ''}`;
        });
        return (
          <span key={emoji} className="gm-tg__reaction" title={`${emoji} ${names.join(', ')}`}>
            <span className="gm-tg__emoji">{emoji}</span>
            {list.length <= 3 ? (
              <span className="gm-tg__reactors">
                {list.map((reaction) => {
                  const user = reaction.userId ? people.get(reaction.userId) : undefined;
                  return (
                    <span key={`${reaction.userId}-${reaction.panel}`} className={cx('gm-tg__mini', `gm-tone-${avatarTone(reaction.userId ?? reaction.emoji)}`)}>
                      {initials(user ? accountName(user) : '?')}
                    </span>
                  );
                })}
              </span>
            ) : (
              <span className="gm-tg__count">{list.length}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function MessageBubble({ message, side, first, last, people }: { message: AdminChatMessage; side: 'left' | 'right'; first: boolean; last: boolean; people: Map<string, AdminChatPerson> }) {
  const [open, setOpen] = useState(false);
  const deleted = !!message.deletedAt;
  const edited = message.edits.length > 0;
  const role = message.senderPanel ? (PANEL_LABEL[message.senderPanel] ?? message.senderPanel) : null;
  return (
    <li className={cx('gm-tg__row', `gm-tg__row--${side}`, first && 'gm-tg__row--first', last && 'gm-tg__row--last')}>
      <div className={cx('gm-tg__bubble', deleted && 'gm-tg__bubble--deleted')}>
        {first && (
          <AccountLink accountNumber={message.sender.accountNumber} className="gm-tg__name">
            <span style={{ color: senderColor(message.sender.id) }}>{accountName(message.sender)}</span>
            <small>
              ID {message.sender.accountNumber}
              {role && ` · ${role}`}
            </small>
          </AccountLink>
        )}
        {deleted && (
          <span className="gm-tg__deleted-tag">
            <Trash2 size={12} />{' '}{t('O‘chirilgan xabar · {dateTime}', { dateTime: formatDateTime(message.deletedAt) })}</span>
        )}
        {message.replyTo && (
          <blockquote className="gm-tg__reply">
            <strong>{t('Javob')}</strong>
            <span>{message.replyTo.deletedAt ? t('O‘chirilgan xabar') : (message.replyTo.text ?? t('Fayl'))}</span>
          </blockquote>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className="gm-tg__files">
            {message.attachments.map((file) => (
              <MediaViewer key={file.mediaAssetId} assetId={file.mediaAssetId} alt={file.name} label={file.name} size="lg" />
            ))}
          </div>
        )}
        {(message.text || !message.attachments?.length) && <p className="gm-tg__text">{message.text ?? '—'}</p>}
        <span className="gm-tg__meta">
          {edited && (
            <button type="button" className="gm-tg__edited" aria-expanded={open} onClick={() => setOpen((value) => !value)} title={t('Tahrirlash tarixini ko‘rish')}>
              <Pencil size={11} />{' '}{t('tahrirlangan ({length})', { length: message.edits.length })}</button>
          )}
          <time title={formatDateTime(message.createdAt)}>{timeOf(message.createdAt)}</time>
        </span>
      </div>
      <Reactions message={message} people={people} />
      {edited && open && (
        <ol className="gm-tg__history">
          {message.edits.map((edit) => (
            <li key={edit.id}>
              <small>{formatDateTime(edit.editedAt)}{' '}{t('da o‘zgartirilgan. Oldingi matn:')}</small>
              <span>{edit.previousText ?? '—'}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function Viewer({ id, onBack }: { id: string; onBack: () => void }) {
  const conversation = useAdminConversation(id);
  const messages = useAdminConversationMessages(id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MsgFilter>('all');
  const scroller = useRef<HTMLDivElement>(null);
  const prevHeight = useRef<number | null>(null);
  const scrolledDown = useRef(false);
  const ordered = useMemo(() => [...(messages.data?.pages.flatMap((page) => page.items) ?? [])].reverse(), [messages.data]);
  const participants = conversation.data?.participants ?? [];
  const people = useMemo(() => new Map(participants.map((p) => [p.user.id, p.user] as const)), [participants]);
  const sideOf = (senderId: string) => (participants.findIndex((p) => p.user.id === senderId) > 0 ? 'right' : 'left');

  const counts = useMemo(
    () => ({
      all: ordered.length,
      deleted: ordered.filter((m) => m.deletedAt).length,
      edited: ordered.filter((m) => m.edits.length > 0).length,
      files: ordered.filter((m) => m.attachments && m.attachments.length > 0).length,
    }),
    [ordered],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ordered.filter((m) => {
      if (filter === 'deleted' && !m.deletedAt) return false;
      if (filter === 'edited' && m.edits.length === 0) return false;
      if (filter === 'files' && !m.attachments?.length) return false;
      if (!needle) return true;
      const haystack = [m.text, accountName(m.sender), ...m.edits.map((e) => e.previousText)].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [ordered, filter, query]);

  // Birinchi yuklashda eng oxirgi xabarga tushamiz; eski xabarlar yuklanganda o‘rnimizni saqlaymiz.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || messages.isLoading) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (!scrolledDown.current && ordered.length > 0) {
      el.scrollTop = el.scrollHeight;
      scrolledDown.current = true;
    }
  }, [ordered, messages.isLoading]);
  useEffect(() => {
    scrolledDown.current = false;
  }, [id]);

  const loadOlder = () => {
    prevHeight.current = scroller.current?.scrollHeight ?? null;
    void messages.fetchNextPage();
  };
  const filtering = filter !== 'all' || query.trim() !== '';

  return (
    <section className="gm-achat__viewer">
      <header className="gm-achat__viewer-head">
        <button type="button" className="gm-achat__back" onClick={onBack} aria-label={t('Suhbatlar ro‘yxatiga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div className="gm-achat__viewer-title">
          <h2>{conversation.data ? conversation.data.participants.map((p) => accountName(p.user)).join('  ↔  ') : t('Suhbat')}</h2>
          {conversation.data && (
            <p>{t('{item} · {length} ta xabar yuklangan', { item: TYPE_LABEL[conversation.data.type], length: ordered.length })}{conversation.data.order && <>{' '}{t('· buyurtma holati:')}{' '}{STATUS_TEXT[conversation.data.order.status as keyof typeof STATUS_TEXT] ?? conversation.data.order.status}</>}
            </p>
          )}
        </div>
        <div className="gm-achat__people">
          {participants.map((p, index) => (
            <AccountLink key={p.user.id} accountNumber={p.user.accountNumber} className={cx('gm-achat__person', index > 0 && 'gm-achat__person--right')}>
              <ChatAvatar name={accountName(p.user)} seed={p.user.id} size="sm" />
              <span>
                <strong>{accountName(p.user)}</strong>
                <small>
                  ID {p.user.accountNumber}
                  {p.roles.length > 0 && ` · ${p.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}`}
                </small>
              </span>
            </AccountLink>
          ))}
        </div>
      </header>

      <div className="gm-achat__toolbar">
        <div className="gm-achat__search gm-achat__search--inline">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Suhbat ichidan qidirish (matn, tahrirlangan matn, ism)')} aria-label={t('Suhbat ichidan qidirish')} />
        </div>
        <div className="gm-achat__types" role="group" aria-label={t('Xabarlarni saralash')}>
          {MSG_FILTERS.map((item) => (
            <button key={item.value} type="button" aria-pressed={filter === item.value} className={cx('gm-otab', filter === item.value && 'gm-otab--active')} onClick={() => setFilter(item.value)}>
              {item.label}
              {item.value !== 'all' && <span className="gm-achat__count">{counts[item.value]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="gm-achat__scroll" ref={scroller}>
        {messages.isError && <Alert tone="danger">{getErrorMessage(messages.error)}</Alert>}
        {messages.hasNextPage && (
          <div className="gm-achat__older">
            <Button size="sm" variant="secondary" loading={messages.isFetchingNextPage} onClick={loadOlder}>{t('Oldingi xabarlarni yuklash')}</Button>
          </div>
        )}
        {messages.isLoading ? (
          <Skeleton style={{ height: 160, borderRadius: 12 }} />
        ) : visible.length === 0 ? (
          <EmptyState title={filtering ? t('Mos xabar topilmadi') : t('Xabar yo‘q')} description={filtering && messages.hasNextPage ? t('Eski xabarlar hali yuklanmagan bo‘lishi mumkin.') : undefined} />
        ) : (
          <ul className="gm-achat__messages">
            {visible.map((message, index) => {
              const prev = visible[index - 1];
              const next = visible[index + 1];
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
              const sameGroup = (a: AdminChatMessage | undefined, b: AdminChatMessage | undefined) =>
                !!a && !!b && a.senderId === b.senderId && a.senderPanel === b.senderPanel && dayKey(a.createdAt) === dayKey(b.createdAt) && Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < GROUP_GAP_MS;
              return (
                <Fragment key={message.id}>
                  {newDay && (
                    <li className="gm-achat__day" aria-hidden="true">
                      <span>{formatDate(message.createdAt)}</span>
                    </li>
                  )}
                  <MessageBubble message={message} side={sideOf(message.senderId)} first={!sameGroup(prev, message)} last={!sameGroup(message, next)} people={people} />
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export function AdminChatsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get('suhbat'));
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const debounced = useDebounce(search, 400);
  const conversations = useAdminConversations({ search: debounced.trim() || undefined, type: type || undefined });
  const all = conversations.data?.items ?? [];
  const items = flaggedOnly ? all.filter((item) => item.deletedCount > 0 || item.editedCount > 0) : all;

  return (
    <div className="gm-achat">
      <div className="gm-page-header">
        <div>
          <h1>{t('Suhbatlar')}</h1>
          <p className="gm-page-lead">{t('Barcha suhbatlar: o‘chirilgan va tahrirlangan xabarlar, ularning asl matni bilan.')}</p>
        </div>
        <Link to="/admin/audit">
          <Button size="sm" variant="secondary">{t('Audit jurnali')}</Button>
        </Link>
      </div>

      <div className={cx('gm-achat__layout', selected && 'gm-achat__layout--open')}>
        <aside className="gm-achat__list" aria-label={t('Suhbatlar ro‘yxati')}>
          <div className="gm-achat__search">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Ism, telefon yoki ID')} aria-label={t('Qidirish')} />
          </div>
          <div className="gm-achat__types" role="group" aria-label={t('Turi')}>
            {TYPE_FILTERS.map((item) => (
              <button key={item.value} type="button" aria-pressed={type === item.value} className={cx('gm-otab', type === item.value && 'gm-otab--active')} onClick={() => setType(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="gm-achat__flagged">
            <input type="checkbox" checked={flaggedOnly} onChange={(event) => setFlaggedOnly(event.target.checked)} />{t('Faqat o‘chirilgan / tahrirlangan xabarli suhbatlar')}</label>
          <small className="gm-achat__total">{items.length}{' '}{t('ta suhbat')}</small>
          {conversations.isError && <Alert tone="danger">{getErrorMessage(conversations.error)}</Alert>}
          {conversations.isLoading && <Skeleton style={{ height: 120, borderRadius: 12 }} />}
          {conversations.data && items.length === 0 && <EmptyState icon={<MessagesSquare size={26} />} title={t('Suhbat topilmadi')} />}
          {items.map((item) => (
            <ConversationRow key={item.id} item={item} active={selected === item.id} onSelect={() => setSelected(item.id)} />
          ))}
        </aside>
        {selected ? (
          <Viewer key={selected} id={selected} onBack={() => setSelected(null)} />
        ) : (
          <div className="gm-achat__placeholder">
            <EmptyState icon={<MessagesSquare size={26} />} title={t('Suhbatni tanlang')} description={t('Chapdan suhbatni tanlang: barcha xabarlar, o‘chirilganlari va tahrir tarixi ko‘rinadi.')} />
          </div>
        )}
      </div>
    </div>
  );
}
