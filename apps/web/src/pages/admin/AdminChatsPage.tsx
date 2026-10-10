import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Ban, Briefcase, ChevronDown, ExternalLink, FileText, Gavel, Info as InfoIcon, MessagesSquare, Pencil, Phone, Search, Star, Trash2, Video, X } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { accountName } from '@/lib/account-name';
import { callLogPreview, describeCallLogAdmin, parseCallLog } from '@/features/call/call-log';
import { getErrorMessage } from '@/lib/error-messages';
import { useDebounce } from '@/hooks/useDebounce';
import { cx, formatDate, formatDateTime, formatMoney, formatNumber, formatRelativeTime, initials } from '@/lib/utils';
import { avatarTone } from '@/features/communication/format';
import { AdminAttachment } from '@/features/admin/components/AdminAttachment';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { AccountLink } from '@/features/admin/components/AccountLink';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { useAdminConversation, useAdminConversationFiles, useAdminConversationMessages, useAdminConversationStats, useAdminConversationTimeline, useAdminConversations } from '@/features/admin/hooks/useAdmin';
import type { AdminChatMessage, AdminChatPerson, AdminConversation, AdminConversationDetail, AdminConversationFilters, AdminUser } from '@/features/admin/types';
import type { UserAction } from '@/features/admin/user-actions';
import { CASE_STATUS_LABEL, CASE_TYPE_LABEL, caseTone } from '@/features/dispute/types';
import type { CaseStatus } from '@/features/dispute/types';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { statusLabel } from '@/lib/labels';
import '@/features/admin/users/UserDrawer.css';
import { PAYMENT_STATUS_LABEL } from '@/features/payment/labels';
import { useMe } from '@/features/session/hooks/useMe';
import type { OrderStatus as OrderStatusEnum, PaymentStatus } from '@/types/common';
import './AdminChatsPage.css';
import { t } from '@/i18n';

const TYPE_LABEL = { ORDER: t('Buyurtma'), DIRECT: t('To‘g‘ridan-to‘g‘ri'), SUPPORT: t('Yordam') } as const;
const PANEL_LABEL: Record<string, string> = { CUSTOMER: 'mijoz', MASTER: 'usta', ADMIN: 'admin' };
const ROLE_LABEL: Record<string, string> = { CUSTOMER: t('Mijoz'), MASTER: t('Usta'), ADMIN: t('Admin') };
const timeOf = (value: string) => formatDateTime(value).split(', ')[1] ?? '';
const dayKey = (value: string) => value.slice(0, 10);
const MSG_FILTERS = [
  { value: 'all', label: t('Hammasi') },
  { value: 'deleted', label: t('O‘chirilgan') },
  { value: 'edited', label: t('Tahrirlangan') },
  { value: 'files', label: t('Fayllar') },
] as const;
type MsgFilter = (typeof MSG_FILTERS)[number]['value'];
type ListTab = '' | 'ORDER' | 'DIRECT' | 'DISPUTED';
type InfoTab = 'info' | 'files' | 'history' | 'cases';
const SORTS = [
  { value: 'recent', label: t('Oxirgi xabar') },
  { value: 'messages', label: t('Xabarlar soni') },
  { value: 'oldest', label: t('Eski suhbatlar') },
];
const FLAGS = [
  { value: '', label: t('Barchasi') },
  { value: 'deleted', label: t('O‘chirilgan xabarli') },
  { value: 'edited', label: t('Tahrirlangan xabarli') },
  { value: 'files', label: t('Fayl yuborilgan') },
];
const STATUS_FILTER: OrderStatusEnum[] = ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED'];
const PAYMENT_TONE: Record<string, BadgeTone> = { SUCCEEDED: 'success', PENDING: 'warning', PROCESSING: 'warning', FAILED: 'danger', CANCELLED: 'neutral', REFUNDED: 'neutral', PARTIALLY_REFUNDED: 'warning' };

function ConversationRow({ item, active, onSelect }: { item: AdminConversation; active: boolean; onSelect: () => void }) {
  const first = item.participants[0]?.user;
  const second = item.participants[1]?.user;
  const names = item.participants.map((p) => accountName(p.user)).join(' ↔ ');
  const last = item.lastMessage;
  const preview = !last ? t('Xabar yo‘q') : last.deletedAt ? t('🗑 O‘chirilgan xabar') : (callLogPreview(last.text) ?? last.text ?? t('📎 Fayl'));
  const hiddenBy = item.participants.filter((p) => p.deletedAt);
  return (
    <button type="button" className={cx('gm-ch__row', active && 'is-active')} onClick={onSelect} aria-current={active ? 'true' : undefined}>
      <span className="gm-ch__pair">
        <ChatAvatar name={accountName(first)} seed={first?.id ?? item.id} src={first?.avatar} />
        {second && <ChatAvatar name={accountName(second)} seed={second.id} size="sm" src={second.avatar} />}
      </span>
      <span className="gm-ch__row-body">
        <span className="gm-ch__row-top">
          <strong>{names}</strong>
          <time>{formatRelativeTime(item.updatedAt)}</time>
        </span>
        <span className={cx('gm-ch__preview', last?.deletedAt && 'is-deleted')}>{preview}</span>
        <span className="gm-ch__flags">
          {item.order ? <span className="gm-ch__tag">№{item.order.orderNumber}</span> : <span className="gm-ch__tag gm-ch__tag--soft">{TYPE_LABEL[item.type]}</span>}
          {item.order?.category && <small>{item.order.category}</small>}
          <small>{t('{count} xabar', { count: item.messageCount })}</small>
          {item.order && item.order.casesCount > 0 && <Badge tone="danger">{t('Nizo')}</Badge>}
          {item.deletedCount > 0 && <Badge tone="danger"><Trash2 size={11} /> {item.deletedCount}</Badge>}
          {item.editedCount > 0 && <Badge tone="warning"><Pencil size={11} /> {item.editedCount}</Badge>}
          {hiddenBy.length > 0 && (
            <span title={t('{join} ro‘yxatidan o‘chirgan (xabarlar saqlangan)', { join: hiddenBy.map((p) => accountName(p.user)).join(', ') })}>
              <Badge tone="neutral"><Trash2 size={11} /> {t('ro‘yxatdan o‘chirgan: {count}', { count: hiddenBy.length })}</Badge>
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
  const callEntry = message.type === 'SYSTEM' ? parseCallLog(message.text) : null;
  const caller = callEntry ? people.get(callEntry.callerId) : undefined;
  const callInfo = callEntry ? describeCallLogAdmin(callEntry, caller ? accountName(caller) : null) : null;
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
            <span>{message.replyTo.deletedAt ? t('O‘chirilgan xabar') : (callLogPreview(message.replyTo.text) ?? message.replyTo.text ?? t('Fayl'))}</span>
          </blockquote>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className="gm-tg__files">
            {message.attachments.map((file) => (
              <AdminAttachment key={file.mediaAssetId} file={file} />
            ))}
          </div>
        )}
        {callEntry && callInfo ? (
          <div className={cx('gm-tg__call', callInfo.failed && 'gm-tg__call--failed')}>
            <span className="gm-tg__call-icon" aria-hidden="true">{callEntry.mode === 'VIDEO' ? <Video size={18} /> : <Phone size={18} />}</span>
            <span className="gm-tg__call-body">
              <strong>{callInfo.title}</strong>
              <small>{callInfo.detail}</small>
            </span>
          </div>
        ) : (
          (message.text || !message.attachments?.length) && <p className="gm-tg__text">{message.text ?? '—'}</p>
        )}
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

function PaymentChip({ payment }: { payment: { provider: string; status: string } | null }) {
  if (!payment) return <Badge tone="neutral">{t('To‘lov yo‘q')}</Badge>;
  return <Badge tone={PAYMENT_TONE[payment.status] ?? 'neutral'}>{t('To‘lov')}: {PAYMENT_STATUS_LABEL[payment.status as PaymentStatus] ?? payment.status}</Badge>;
}

const asUser = (person: AdminChatPerson): AdminUser => ({
  id: person.id,
  accountNumber: person.accountNumber,
  phone: person.phone,
  email: person.email ?? null,
  firstName: person.firstName,
  lastName: person.lastName,
  status: (person.status as AdminUser['status']) ?? 'ACTIVE',
  createdAt: '',
  deletedAt: null,
  roles: [],
  masterProfile: null,
});

function PartyCard({ title, person, roles, canModerate, onBlock }: { title: string; person: AdminChatPerson; roles: string[]; canModerate: boolean; onBlock: () => void }) {
  const navigate = useNavigate();
  const name = accountName(person);
  const restricted = person.status === 'BLOCKED' || person.status === 'SUSPENDED';
  return (
    <section className="gm-udr__card gm-ch__party">
      <h3>{title}</h3>
      <div className="gm-ch__party-head">
        <ChatAvatar name={name} seed={person.id} size="lg" src={person.avatar} />
        <div>
          <strong>{name}</strong>
          <span className="gm-ch__party-badges">
            {roles.map((role) => <Badge key={role} tone="primary">{ROLE_LABEL[role] ?? role}</Badge>)}
            {restricted && <Badge tone="danger">{person.status === 'BLOCKED' ? t('Bloklangan') : t('Muzlatilgan')}</Badge>}
          </span>
          {person.masterProfile && (
            <small>
              {person.masterProfile.profession ?? ''}
              {Number(person.masterProfile.ratingAvg) > 0 && <> · <Star size={11} fill="currentColor" aria-hidden="true" /> {Number(person.masterProfile.ratingAvg).toFixed(1)} ({person.masterProfile.ratingCount})</>}
            </small>
          )}
        </div>
      </div>
      <div className="gm-udr__row"><span>{t('Telefon')}</span><strong>{person.phone}</strong></div>
      {person.email && <div className="gm-udr__row"><span>Email</span><strong>{person.email}</strong></div>}
      <div className="gm-udr__row"><span>ID</span><strong>{person.accountNumber}</strong></div>
      <div className="gm-ch__party-actions">
        <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/foydalanuvchilar/${person.accountNumber}`)}><ExternalLink size={14} aria-hidden="true" /> {t('Profilni ko‘rish')}</Button>
        {canModerate && !restricted && <Button size="sm" variant="secondary" className="gm-udr__danger" onClick={onBlock}><Ban size={14} aria-hidden="true" /> {t('Bloklash')}</Button>}
      </div>
    </section>
  );
}

function InfoPanel({ conversation, loading, onClose, canModerate }: { conversation: AdminConversationDetail | undefined; loading: boolean; onClose: () => void; canModerate: boolean }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<InfoTab>('info');
  const [block, setBlock] = useState<AdminChatPerson | null>(null);
  const id = conversation?.id ?? null;
  const files = useAdminConversationFiles(id, tab === 'files');
  const timeline = useAdminConversationTimeline(id, tab === 'history');
  useEffect(() => setTab('info'), [id]);
  const order = conversation?.order ?? null;
  const casesCount = order?.cases.length ?? 0;
  const tabs: Array<[InfoTab, string]> = [['info', t('Ma’lumotlar')], ['files', t('Fayllar')], ['history', t('Tarix')], ['cases', casesCount > 0 ? t('Nizolar ({count})', { count: casesCount }) : t('Nizolar')]];
  const customer = conversation?.participants.find((p) => p.roles.includes('CUSTOMER') && !p.roles.includes('ADMIN'));
  const master = conversation?.participants.find((p) => p.roles.includes('MASTER'));
  const others = (conversation?.participants ?? []).filter((p) => p !== customer && p !== master);

  const eventText = (event: NonNullable<typeof timeline.data>['items'][number]) => {
    const who = event.actor ? accountName(event.actor) : t('Tizim');
    switch (event.kind) {
      case 'created': return t('Suhbat ochildi');
      case 'first_message': return t('{who} birinchi xabarni yozdi', { who });
      case 'deleted': return t('{who} xabarni o‘chirdi', { who });
      case 'edited': return t('{who} xabarni tahrirladi', { who });
      case 'call': return `${event.detail.mode === 'VIDEO' ? t('Video qo‘ng‘iroq') : t('Audio qo‘ng‘iroq')} · ${who}${event.detail.seconds ? ` · ${event.detail.seconds} ${t('soniya')}` : ''}`;
      case 'order_status': return t('Buyurtma holati: {status}', { status: String(event.detail.status) });
      default: return event.kind;
    }
  };

  return (
    <aside className="gm-ch__info" aria-label={t('Suhbat haqida')}>
      <header className="gm-ch__info-head">
        <div className="gm-udr__tabs" role="tablist">
          {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={cx(tab === value && 'is-on')} onClick={() => setTab(value)}>{label}</button>)}
        </div>
        <button type="button" className="gm-ch__info-close" onClick={onClose} aria-label={t('Yopish')}><X size={18} /></button>
      </header>
      <div className="gm-ch__info-body">
        {loading && <Skeleton style={{ height: 160, borderRadius: 12 }} />}
        {conversation && tab === 'info' && (
          <>
            {customer && <PartyCard title={t('Mijoz ma’lumotlari')} person={customer.user} roles={customer.roles} canModerate={canModerate} onBlock={() => setBlock(customer.user)} />}
            {master && <PartyCard title={t('Usta ma’lumotlari')} person={master.user} roles={master.roles} canModerate={canModerate} onBlock={() => setBlock(master.user)} />}
            {others.map((p) => <PartyCard key={p.user.id} title={t('Ishtirokchi')} person={p.user} roles={p.roles} canModerate={false} onBlock={() => undefined} />)}
            {order ? (
              <section className="gm-udr__card">
                <h3>{t('Buyurtma ma’lumotlari')}</h3>
                <div className="gm-udr__row"><span>№</span><strong>{order.orderNumber} <OrderStatus status={order.status as OrderStatusEnum} /></strong></div>
                <div className="gm-udr__row"><span>{t('Xizmat')}</span><strong>{order.category ?? order.title}</strong></div>
                <div className="gm-udr__row"><span>{t('Yaratilgan sana')}</span><strong>{formatDateTime(order.createdAt)}</strong></div>
                <div className="gm-udr__row"><span>{t('Jami summa')}</span><strong>{formatMoney(order.finalAmount, order.currency)}</strong></div>
                <div className="gm-udr__row"><span>{t('To‘lov holati')}</span><strong><PaymentChip payment={order.payment} /></strong></div>
                {order.city && <div className="gm-udr__row"><span>{t('Hudud')}</span><strong>{[order.city, order.district].filter(Boolean).join(', ')}</strong></div>}
                <Button fullWidth variant="secondary" onClick={() => navigate(`/admin/buyurtmalar/${order.id}`)}><Briefcase size={15} aria-hidden="true" /> {t('Buyurtmaga o‘tish')}</Button>
              </section>
            ) : (
              <section className="gm-udr__card">
                <h3>{t('Suhbat turi')}</h3>
                <p className="gm-udr__muted">{conversation.type === 'SUPPORT' ? t('Yordam suhbati: foydalanuvchi va administratorlar o‘rtasida.') : t('Buyurtmaga bog‘lanmagan to‘g‘ridan-to‘g‘ri suhbat.')}</p>
              </section>
            )}
            <section className="gm-udr__card">
              <h3>{t('Tez amallar')}</h3>
              <div className="gm-udr__actions">
                {order && <Button variant="secondary" onClick={() => navigate(`/admin/buyurtmalar/${order.id}`)}><ExternalLink size={16} aria-hidden="true" /> {t('Buyurtmani ochish')}</Button>}
                {order && <Button variant="secondary" disabled={casesCount === 0} onClick={() => setTab('cases')}><Gavel size={16} aria-hidden="true" /> {t('Nizoni ko‘rib chiqish')}</Button>}
                <Button variant="secondary" onClick={() => setTab('files')}><FileText size={16} aria-hidden="true" /> {t('Fayllarni ko‘rish')}</Button>
                <Button variant="secondary" onClick={() => setTab('history')}><InfoIcon size={16} aria-hidden="true" /> {t('Tarixni ko‘rish')}</Button>
              </div>
              <Alert tone="info">{t('Bu suhbatni ko‘rish faqat nazorat uchun: administrator xabar yoza olmaydi. Foydalanuvchi ustidagi barcha amallar audit jurnalida saqlanadi.')}</Alert>
            </section>
          </>
        )}

        {tab === 'files' && (
          <section className="gm-udr__card">
            <h3>{t('Suhbatdagi fayllar')}</h3>
            {files.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
            {files.isError && <Alert tone="danger">{getErrorMessage(files.error)}</Alert>}
            {files.data && files.data.items.length === 0 && <p className="gm-udr__muted">{t('Fayl yuborilmagan.')}</p>}
            <div className="gm-ch__files">
              {files.data?.items.map((file) => (
                <div key={`${file.messageId}-${file.mediaAssetId}`} className="gm-ch__file">
                  <AdminAttachment file={{ mediaAssetId: file.mediaAssetId, mimeType: file.mimeType, name: file.name }} />
                  <small>{accountName(file.sender)} · {formatDateTime(file.createdAt)}{file.messageDeletedAt ? ` · ${t('xabar o‘chirilgan')}` : ''}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'history' && (
          <section className="gm-udr__card">
            <h3>{t('Suhbat tarixi')}</h3>
            {timeline.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
            {timeline.isError && <Alert tone="danger">{getErrorMessage(timeline.error)}</Alert>}
            {timeline.data?.items.map((event) => (
              <div key={event.id} className={cx('gm-ch__event', `gm-ch__event--${event.kind}`)}>
                <i aria-hidden="true" />
                <span>
                  <strong>{eventText(event)}</strong>
                  {event.kind === 'order_status' && event.detail.reason ? <small>{String(event.detail.reason)}</small> : null}
                  <small>{formatDateTime(event.at)} · {formatRelativeTime(event.at)}</small>
                </span>
              </div>
            ))}
          </section>
        )}

        {tab === 'cases' && (
          <section className="gm-udr__card">
            <h3>{t('Nizo va shikoyatlar')}</h3>
            {conversation && casesCount === 0 && <p className="gm-udr__muted">{order ? t('Bu buyurtma bo‘yicha nizo yoki shikoyat yo‘q.') : t('Bu suhbat buyurtmaga bog‘lanmagan.')}</p>}
            {order?.cases.map((item) => (
              <div key={item.id} className="gm-udr__sub">
                <span>
                  <strong>{item.title}</strong>
                  <small>{CASE_TYPE_LABEL[item.type] ?? item.type} · {formatDateTime(item.createdAt)}</small>
                </span>
                <Badge tone={caseTone(item.status) === 'ok' ? 'success' : caseTone(item.status) === 'no' ? 'neutral' : 'warning'}>{CASE_STATUS_LABEL[item.status as CaseStatus] ?? item.status}</Badge>
              </div>
            ))}
            {casesCount > 0 && <Button fullWidth variant="secondary" onClick={() => navigate('/admin/shikoyatlar')}>{t('Shikoyat va nizolar bo‘limiga o‘tish')}</Button>}
          </section>
        )}
      </div>
      {block && <UserActionDialog user={asUser(block)} action={'BLOCK' satisfies UserAction} onClose={() => setBlock(null)} />}
    </aside>
  );
}

function Viewer({ id, onBack, infoOpen, onToggleInfo, canModerate }: { id: string; onBack: () => void; infoOpen: boolean; onToggleInfo: () => void; canModerate: boolean }) {
  const navigate = useNavigate();
  const conversation = useAdminConversation(id);
  const messages = useAdminConversationMessages(id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MsgFilter>('all');
  const scroller = useRef<HTMLDivElement>(null);
  const prevHeight = useRef<number | null>(null);
  const scrolledDown = useRef(false);
  const ordered = useMemo(() => [...(messages.data?.pages.flatMap((page) => page.items) ?? [])].reverse(), [messages.data]);
  const participants = useMemo(() => conversation.data?.participants ?? [], [conversation.data]);
  const people = useMemo(() => new Map(participants.map((p) => [p.user.id, p.user] as const)), [participants]);
  const sideOf = (senderId: string) => (participants.findIndex((p) => p.user.id === senderId) > 0 ? 'right' : 'left');
  const order = conversation.data?.order;

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
  const first = participants[0]?.user;

  return (
    <>
      <section className="gm-ch__viewer">
        <header className="gm-ch__viewer-head">
          <button type="button" className="gm-ch__back" onClick={onBack} aria-label={t('Suhbatlar ro‘yxatiga qaytish')}>
            <ArrowLeft size={18} />
          </button>
          <div className="gm-ch__people">
            {participants.map((p, index) => (
              <AccountLink key={p.user.id} accountNumber={p.user.accountNumber} className={cx('gm-ch__person', index > 0 && 'is-second')}>
                <ChatAvatar name={accountName(p.user)} seed={p.user.id} size="md" src={p.user.avatar} />
                <span>
                  <strong>{accountName(p.user)} {p.roles.map((r) => <Badge key={r} tone="primary">{ROLE_LABEL[r] ?? r}</Badge>)}</strong>
                  <small>{p.user.phone} · ID {p.user.accountNumber}</small>
                </span>
              </AccountLink>
            ))}
            {!first && <Skeleton style={{ height: 40, width: 220, borderRadius: 12 }} />}
          </div>
          <div className="gm-ch__head-actions">
            {order && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/buyurtmalar/${order.id}`)}>
                <Briefcase size={15} aria-hidden="true" /> {t('Buyurtma tafsilotlari')}
              </Button>
            )}
            <Button size="sm" variant={infoOpen ? 'primary' : 'secondary'} className="gm-ch__info-toggle" onClick={onToggleInfo} aria-pressed={infoOpen}>
              <InfoIcon size={15} aria-hidden="true" /> {t('Ma’lumot')}
            </Button>
          </div>
        </header>

        {order && (
          <div className="gm-ch__order">
            <strong>№{order.orderNumber}</strong>
            <span>{order.category ?? order.title}</span>
            <OrderStatus status={order.status as OrderStatusEnum} />
            <PaymentChip payment={order.payment} />
            <span className="gm-ch__order-sum">{t('Jami')}: <b>{formatMoney(order.finalAmount, order.currency)}</b></span>
          </div>
        )}

        <div className="gm-ch__toolbar">
          <label className="gm-ch__search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Suhbat ichidan qidirish (matn, tahrirlangan matn, ism)')} aria-label={t('Suhbat ichidan qidirish')} />
          </label>
          <div className="gm-ch__chips" role="group" aria-label={t('Xabarlarni saralash')}>
            {MSG_FILTERS.map((item) => (
              <button key={item.value} type="button" aria-pressed={filter === item.value} className={cx(filter === item.value && 'is-on')} onClick={() => setFilter(item.value)}>
                {item.label}
                {item.value !== 'all' && <span>{counts[item.value]}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="gm-ch__scroll" ref={scroller}>
          {messages.isError && <Alert tone="danger">{getErrorMessage(messages.error)}</Alert>}
          {messages.hasNextPage && (
            <div className="gm-ch__older">
              <Button size="sm" variant="secondary" loading={messages.isFetchingNextPage} onClick={loadOlder}>{t('Oldingi xabarlarni yuklash')}</Button>
            </div>
          )}
          {messages.isLoading ? (
            <Skeleton style={{ height: 160, borderRadius: 12 }} />
          ) : visible.length === 0 ? (
            <EmptyState title={filtering ? t('Mos xabar topilmadi') : t('Xabar yo‘q')} description={filtering && messages.hasNextPage ? t('Eski xabarlar hali yuklanmagan bo‘lishi mumkin.') : undefined} />
          ) : (
            <ul className="gm-ch__messages">
              {visible.map((message, index) => {
                const prev = visible[index - 1];
                const next = visible[index + 1];
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
                const sameGroup = (a: AdminChatMessage | undefined, b: AdminChatMessage | undefined) =>
                  !!a && !!b && a.senderId === b.senderId && a.senderPanel === b.senderPanel && dayKey(a.createdAt) === dayKey(b.createdAt) && Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < GROUP_GAP_MS;
                return (
                  <Fragment key={message.id}>
                    {newDay && (
                      <li className="gm-ch__day" aria-hidden="true">
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
        <footer className="gm-ch__readonly">
          <InfoIcon size={14} aria-hidden="true" /> {t('Nazorat rejimi: bu suhbatga xabar yozib bo‘lmaydi')} · {t('{count} ta xabar yuklangan', { count: ordered.length })}
        </footer>
      </section>
      {infoOpen && <div className="gm-ch__info-backdrop" onClick={onToggleInfo} aria-hidden="true" />}
      <div className={cx('gm-ch__info-wrap', infoOpen && 'is-open')}>
        <InfoPanel conversation={conversation.data} loading={conversation.isLoading} onClose={onToggleInfo} canModerate={canModerate} />
      </div>
    </>
  );
}

export function AdminChatsPage() {
  const [params] = useSearchParams();
  const me = useMe();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<ListTab>('');
  const [orderStatus, setOrderStatus] = useState('');
  const [flag, setFlag] = useState('');
  const [sort, setSort] = useState<'recent' | 'oldest' | 'messages'>('recent');
  const [selected, setSelected] = useState<string | null>(params.get('suhbat'));
  const [infoOpen, setInfoOpen] = useState(false);
  const debounced = useDebounce(search.trim(), 400);
  const canModerate = !!me.data?.isSuperAdmin || !!me.data?.adminPermissions?.includes('USERS');

  const filters = useMemo<AdminConversationFilters>(
    () => ({
      search: debounced || undefined,
      type: tab === 'ORDER' || tab === 'DIRECT' ? tab : undefined,
      orderStatus: orderStatus || undefined,
      flag: tab === 'DISPUTED' ? 'disputed' : ((flag || undefined) as AdminConversationFilters['flag']),
      sort,
    }),
    [debounced, tab, orderStatus, flag, sort],
  );
  const conversations = useAdminConversations(filters);
  const stats = useAdminConversationStats();
  const items = useMemo(() => conversations.data?.pages.flatMap((page) => page.items) ?? [], [conversations.data]);
  const s = stats.data;
  const dirty = !!(search || tab || orderStatus || flag || sort !== 'recent');
  const tabs: Array<[ListTab, string, number | undefined]> = [['', t('Barchasi'), s?.total], ['ORDER', t('Buyurtma'), s?.order], ['DIRECT', t('To‘g‘ridan-to‘g‘ri'), s?.direct], ['DISPUTED', t('Nizoli'), s?.disputed]];

  return (
    <div className="gm-ch">
      <header className="gm-ch__head">
        <div>
          <h1>{t('Suhbatlar')}</h1>
          <p>{t('Foydalanuvchilar yozishmalarini nazorat qiling: o‘chirilgan va tahrirlangan xabarlar asl matni bilan.')}</p>
        </div>
        {s && <span className="gm-ch__totals">{t('Jami {count} ta xabar', { count: formatNumber(s.messages) })}</span>}
        <Link to="/admin/audit"><Button size="sm" variant="secondary">{t('Audit jurnali')}</Button></Link>
      </header>

      <div className={cx('gm-ch__layout', selected && 'is-open')}>
        <aside className="gm-ch__list" aria-label={t('Suhbatlar ro‘yxati')}>
          <div className="gm-ch__tabs" role="tablist" aria-label={t('Turi')}>
            {tabs.map(([value, label, count]) => (
              <button key={value || 'all'} type="button" role="tab" aria-selected={tab === value} className={cx(tab === value && 'is-on')} onClick={() => setTab(value)}>
                {label}{count !== undefined && <span>{formatNumber(count)}</span>}
              </button>
            ))}
          </div>
          <label className="gm-ch__search">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Ism, telefon, ID yoki buyurtma №...')} aria-label={t('Qidirish')} />
          </label>
          <div className="gm-ch__selects">
            <label>
              <span>{t('Buyurtma holati')}</span>
              <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}>
                <option value="">{t('Barchasi')}</option>
                {STATUS_FILTER.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('Xabarlar')}</span>
              <select value={flag} onChange={(event) => setFlag(event.target.value)} disabled={tab === 'DISPUTED'}>
                {FLAGS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <div className="gm-ch__sortrow">
            <label>
              <span>{t('Saralash')}:</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {dirty && <button type="button" onClick={() => { setSearch(''); setTab(''); setOrderStatus(''); setFlag(''); setSort('recent'); }}>{t('Tozalash')}</button>}
          </div>
          <div className="gm-ch__rows">
            {conversations.isError && <Alert tone="danger">{getErrorMessage(conversations.error)}</Alert>}
            {conversations.isLoading && <Skeleton style={{ height: 160, borderRadius: 12 }} />}
            {conversations.data && items.length === 0 && <EmptyState icon={<MessagesSquare size={26} />} title={t('Suhbat topilmadi')} />}
            {items.map((item) => <ConversationRow key={item.id} item={item} active={selected === item.id} onSelect={() => { setSelected(item.id); setInfoOpen(false); }} />)}
            {conversations.hasNextPage && (
              <Button variant="secondary" size="sm" loading={conversations.isFetchingNextPage} onClick={() => void conversations.fetchNextPage()}>
                <ChevronDown size={15} aria-hidden="true" /> {t('Yana yuklash')}
              </Button>
            )}
          </div>
        </aside>
        {selected ? (
          <Viewer key={selected} id={selected} onBack={() => { setSelected(null); setInfoOpen(false); }} infoOpen={infoOpen} onToggleInfo={() => setInfoOpen((open) => !open)} canModerate={canModerate} />
        ) : (
          <div className="gm-ch__placeholder">
            <EmptyState icon={<MessagesSquare size={26} />} title={t('Suhbatni tanlang')} description={t('Chapdan suhbatni tanlang: barcha xabarlar, o‘chirilganlari va tahrir tarixi ko‘rinadi.')} />
          </div>
        )}
      </div>
    </div>
  );
}
