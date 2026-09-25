import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, MessagesSquare, Pencil, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { useDebounce } from '@/hooks/useDebounce';
import { cx, formatDate, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { AccountLink } from '@/features/admin/components/AccountLink';
import { useAdminConversation, useAdminConversationMessages, useAdminConversations } from '@/features/admin/hooks/useAdmin';
import type { AdminChatMessage, AdminChatPerson, AdminConversation } from '@/features/admin/types';
import './AdminChatsPage.css';

const TYPE_LABEL = { ORDER: 'Buyurtma', DIRECT: 'To‘g‘ridan-to‘g‘ri', SUPPORT: 'Yordam' } as const;
const TYPE_FILTERS = [
  { value: '', label: 'Hammasi' },
  { value: 'DIRECT', label: 'To‘g‘ridan-to‘g‘ri' },
  { value: 'ORDER', label: 'Buyurtma' },
];
const PANEL_LABEL: Record<string, string> = { CUSTOMER: 'mijoz', MASTER: 'usta', ADMIN: 'admin' };
const person = (user: AdminChatPerson) => `${accountName(user)} · ID ${user.accountNumber}`;
const ROLE_LABEL: Record<string, string> = { CUSTOMER: 'mijoz', MASTER: 'usta', ADMIN: 'admin' };
const timeOf = (value: string) => formatDateTime(value).split(', ')[1] ?? '';
const dayKey = (value: string) => value.slice(0, 10);
const MSG_FILTERS = [
  { value: 'all', label: 'Hammasi' },
  { value: 'deleted', label: 'O‘chirilgan' },
  { value: 'edited', label: 'Tahrirlangan' },
  { value: 'files', label: 'Fayllar' },
] as const;
type MsgFilter = (typeof MSG_FILTERS)[number]['value'];

function ConversationRow({ item, active, onSelect }: { item: AdminConversation; active: boolean; onSelect: () => void }) {
  const names = item.participants.map((p) => accountName(p.user)).join(' ↔ ');
  const last = item.lastMessage;
  const preview = !last ? 'Xabar yo‘q' : last.deletedAt ? '🗑 O‘chirilgan xabar' : (last.text ?? '📎 Fayl');
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
        </span>
      </span>
    </button>
  );
}

function MessageCard({ message, side }: { message: AdminChatMessage; side: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const deleted = !!message.deletedAt;
  const edited = message.edits.length > 0;
  return (
    <li className={cx('gm-achat__msg', `gm-achat__msg--${side}`, deleted && 'gm-achat__msg--deleted')}>
      <header>
        <AccountLink userId={message.sender.id} className="gm-achat__sender">
          <strong>{person(message.sender)}</strong>
        </AccountLink>
        {message.senderPanel && <Badge tone="neutral">{PANEL_LABEL[message.senderPanel] ?? message.senderPanel}</Badge>}
        <time title={formatDateTime(message.createdAt)}>{timeOf(message.createdAt)}</time>
        {deleted && (
          <Badge tone="danger">
            <Trash2 size={11} /> O‘chirilgan {formatDateTime(message.deletedAt)}
          </Badge>
        )}
        {edited && (
          <Badge tone="warning">
            <Pencil size={11} /> Tahrirlangan ({message.edits.length})
          </Badge>
        )}
      </header>
      {message.replyTo && <blockquote className="gm-achat__reply">↩ {message.replyTo.text ?? '[fayl yoki o‘chirilgan xabar]'}</blockquote>}
      {message.attachments && message.attachments.length > 0 && (
        <div className="gm-achat__files">
          {message.attachments.map((file) => (
            <MediaViewer key={file.mediaAssetId} assetId={file.mediaAssetId} alt={file.name} label={file.name} />
          ))}
        </div>
      )}
      {(message.text || !message.attachments?.length) && <p>{message.text ?? '—'}</p>}
      {message.reactions && message.reactions.length > 0 && <small>{message.reactions.map((reaction) => reaction.emoji).join(' ')}</small>}
      {edited && (
        <>
          <button type="button" className="gm-achat__toggle" onClick={() => setOpen((value) => !value)}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Tahrirlash tarixi
          </button>
          {open && (
            <ol className="gm-achat__history">
              {message.edits.map((edit) => (
                <li key={edit.id}>
                  <small>{formatDateTime(edit.editedAt)} da o‘zgartirilgan. Oldingi matn:</small>
                  <span>{edit.previousText ?? '—'}</span>
                </li>
              ))}
            </ol>
          )}
        </>
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
        <button type="button" className="gm-achat__back" onClick={onBack} aria-label="Suhbatlar ro‘yxatiga qaytish">
          <ArrowLeft size={18} />
        </button>
        <div className="gm-achat__viewer-title">
          <h2>{conversation.data ? conversation.data.participants.map((p) => accountName(p.user)).join('  ↔  ') : 'Suhbat'}</h2>
          {conversation.data && (
            <p>
              {TYPE_LABEL[conversation.data.type]} · {ordered.length} ta xabar yuklangan
              {conversation.data.order && <> · buyurtma holati: {conversation.data.order.status}</>}
            </p>
          )}
        </div>
        <div className="gm-achat__people">
          {participants.map((p, index) => (
            <AccountLink key={p.user.id} userId={p.user.id} className={cx('gm-achat__person', index > 0 && 'gm-achat__person--right')}>
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suhbat ichidan qidirish (matn, tahrirlangan matn, ism)" aria-label="Suhbat ichidan qidirish" />
        </div>
        <div className="gm-achat__types" role="group" aria-label="Xabarlarni saralash">
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
            <Button size="sm" variant="secondary" loading={messages.isFetchingNextPage} onClick={loadOlder}>
              Oldingi xabarlarni yuklash
            </Button>
          </div>
        )}
        {messages.isLoading ? (
          <Skeleton style={{ height: 160, borderRadius: 12 }} />
        ) : visible.length === 0 ? (
          <EmptyState title={filtering ? 'Mos xabar topilmadi' : 'Xabar yo‘q'} description={filtering && messages.hasNextPage ? 'Eski xabarlar hali yuklanmagan bo‘lishi mumkin.' : undefined} />
        ) : (
          <ul className="gm-achat__messages">
            {visible.map((message, index) => (
              <Fragment key={message.id}>
                {(index === 0 || dayKey(visible[index - 1]!.createdAt) !== dayKey(message.createdAt)) && (
                  <li className="gm-achat__day" aria-hidden="true">
                    <span>{formatDate(message.createdAt)}</span>
                  </li>
                )}
                <MessageCard message={message} side={sideOf(message.senderId)} />
              </Fragment>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function AdminChatsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const debounced = useDebounce(search, 400);
  const conversations = useAdminConversations({ search: debounced.trim() || undefined, type: type || undefined });
  const all = conversations.data?.items ?? [];
  const items = flaggedOnly ? all.filter((item) => item.deletedCount > 0 || item.editedCount > 0) : all;

  return (
    <div className="gm-achat">
      <div className="gm-page-header">
        <div>
          <h1>Suhbatlar</h1>
          <p className="gm-page-lead">Barcha suhbatlar: o‘chirilgan va tahrirlangan xabarlar, ularning asl matni bilan.</p>
        </div>
        <Link to="/admin/audit">
          <Button size="sm" variant="secondary">
            Audit jurnali
          </Button>
        </Link>
      </div>

      <div className={cx('gm-achat__layout', selected && 'gm-achat__layout--open')}>
        <aside className="gm-achat__list" aria-label="Suhbatlar ro‘yxati">
          <div className="gm-achat__search">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ism, telefon yoki ID" aria-label="Qidirish" />
          </div>
          <div className="gm-achat__types" role="group" aria-label="Turi">
            {TYPE_FILTERS.map((item) => (
              <button key={item.value} type="button" aria-pressed={type === item.value} className={cx('gm-otab', type === item.value && 'gm-otab--active')} onClick={() => setType(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="gm-achat__flagged">
            <input type="checkbox" checked={flaggedOnly} onChange={(event) => setFlaggedOnly(event.target.checked)} />
            Faqat o‘chirilgan / tahrirlangan xabarli suhbatlar
          </label>
          <small className="gm-achat__total">{items.length} ta suhbat</small>
          {conversations.isError && <Alert tone="danger">{getErrorMessage(conversations.error)}</Alert>}
          {conversations.isLoading && <Skeleton style={{ height: 120, borderRadius: 12 }} />}
          {conversations.data && items.length === 0 && <EmptyState icon={<MessagesSquare size={26} />} title="Suhbat topilmadi" />}
          {items.map((item) => (
            <ConversationRow key={item.id} item={item} active={selected === item.id} onSelect={() => setSelected(item.id)} />
          ))}
        </aside>
        {selected ? (
          <Viewer key={selected} id={selected} onBack={() => setSelected(null)} />
        ) : (
          <div className="gm-achat__placeholder">
            <EmptyState icon={<MessagesSquare size={26} />} title="Suhbatni tanlang" description="Chapdan suhbatni tanlang: barcha xabarlar, o‘chirilganlari va tahrir tarixi ko‘rinadi." />
          </div>
        )}
      </div>
    </div>
  );
}
