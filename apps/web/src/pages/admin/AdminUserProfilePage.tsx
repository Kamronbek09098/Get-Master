import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, KeyRound, MessageCircle, Ban, CheckCircle2, MapPin, Building2, Snowflake, Trash2, ArrowLeft, CalendarClock, Mail, MessageSquare, Package, Phone, ShieldCheck, Smartphone, Star, Wrench, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney, formatRelativeTime } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { useAdminUserByNumber } from '@/features/admin/hooks/useAdmin';
import { accountPath } from '@/features/admin/components/AccountLink';
import { actionInfo } from '@/features/admin/audit-labels';
import { useMe } from '@/features/session/hooks/useMe';
import { useOpenSupportChat } from '@/features/communication/hooks/useCommunication';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { PasswordResetDialog } from '@/features/admin/components/PasswordResetDialog';
import type { UserAction } from '@/features/admin/user-actions';
import type { AdminUser } from '@/features/admin/types';
import './AdminUserProfilePage.css';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Akkaunt faol', tone: 'success' },
  PENDING: { label: 'Telefon tasdiqlanmagan', tone: 'neutral' },
  SUSPENDED: { label: 'Akkaunt muzlatilgan', tone: 'warning' },
  BLOCKED: { label: 'Akkaunt bloklangan', tone: 'danger' },
  DELETED: { label: 'O‘chirilgan', tone: 'neutral' },
};
const orderTone = (status: string): 'success' | 'danger' | 'warning' | 'info' => {
  if (status === 'COMPLETED') return 'success';
  if (['CANCELLED', 'EXPIRED', 'DISPUTED'].includes(status)) return 'danger';
  if (['DRAFT', 'SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED', 'WAITING_CONFIRMATION'].includes(status)) return 'warning';
  return 'info';
};
const ROLE: Record<string, string> = { CUSTOMER: 'Mijoz', MASTER: 'Usta', ADMIN: 'Admin' };

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="gm-uprofile__field">
      <span className="gm-uprofile__field-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <small>{label}</small>
        <span>{children}</span>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return (
    <div className="gm-uprofile__stat">
      {icon}
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

export function AdminUserProfilePage() {
  const { id } = useParams();
  const me = useMe();
  const [action, setAction] = useState<UserAction | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [loginCopied, setLoginCopied] = useState(false);
  const navigate = useNavigate();
  const openChat = useOpenSupportChat();
  const number = id && /^\d{1,9}$/.test(id) ? Number(id) : null;
  const user = useAdminUserByNumber(number);

  // O‘z akkaunti bo‘lsa — shaxsiy profil bo‘limiga.
  if (number !== null && me.data?.accountNumber === number) return <Navigate to="/sozlamalar" replace />;

  const data = user.data;
  const status = data ? (STATUS[data.status] ?? { label: data.status, tone: 'neutral' as BadgeTone }) : null;

  return (
    <div className="gm-uprofile">
      {openChat.isError && <Alert tone="danger">{getErrorMessage(openChat.error)}</Alert>}
      <Link to="/admin/foydalanuvchilar" className="gm-uprofile__back">
        <ArrowLeft size={16} /> Foydalanuvchilar
      </Link>
      {user.isLoading && <PageLoader />}
      {user.isError && <Alert tone="danger">{getErrorMessage(user.error)}</Alert>}
      {data && status && (
        <>
          <header className="gm-uprofile__hero">
            <ChatAvatar name={accountName(data)} seed={data.id} size="lg" />
            <div className="gm-uprofile__who">
              <h1>{accountName(data)}</h1>
              <p>
                ID {data.accountNumber}
                {data.masterProfile?.profession && ` · ${data.masterProfile.profession}`}
              </p>
              <div className="gm-uprofile__badges">
                {data.roles.map((role) => (
                  <Badge key={role} tone="primary">
                    {ROLE[role] ?? role}
                  </Badge>
                ))}
                <Badge tone={status.tone}>{status.label}</Badge>
                {data.status === 'DELETED' && (
                  <Badge tone={data.registrationBlocked ? 'danger' : 'success'}>{data.registrationBlocked ? 'Qayta ro‘yxatdan o‘tish bloklangan' : 'Qayta ro‘yxatdan o‘tish mumkin'}</Badge>
                )}
                {data.masterProfile && <TrustBadge verification={data.masterProfile.verification} />}
              </div>
            </div>
            <div className="gm-uprofile__actions">
              {data.status === 'DELETED' && !data.roles.includes('ADMIN') && (
                <Button
                  size="sm"
                  variant={data.registrationBlocked ? 'secondary' : 'ghost'}
                  className={data.registrationBlocked ? undefined : 'gm-btn-danger-text'}
                  onClick={() => setAction(data.registrationBlocked ? 'ALLOW_REGISTRATION' : 'BLOCK_REGISTRATION')}
                >
                  <Ban size={16} /> {data.registrationBlocked ? 'Ro‘yxatdan o‘tishga ruxsat berish' : 'Qayta ro‘yxatdan o‘tishni bloklash'}
                </Button>
              )}
              {data.roles.includes('ADMIN') && data.status !== 'DELETED' && data.id !== me.data?.id && (
                <Button size="sm" variant="ghost" className="gm-btn-danger-text" onClick={() => setAction('DELETE')}>
                  <Trash2 size={16} /> Adminni o‘chirish
                </Button>
              )}
              {!data.roles.includes('ADMIN') && data.status !== 'DELETED' && (
                <>
                  {data.status === 'SUSPENDED' || data.status === 'BLOCKED' ? (
                    <Button size="sm" onClick={() => setAction('ACTIVATE')}>
                      <CheckCircle2 size={16} /> Faollashtirish
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--warn" onClick={() => setAction('SUSPEND')}>
                        <Snowflake size={16} /> Muzlatish
                      </Button>
                      <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--danger" onClick={() => setAction('BLOCK')}>
                        <Ban size={16} /> Bloklash
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="gm-btn-danger-text" onClick={() => setAction('DELETE')}>
                    <Trash2 size={16} /> O‘chirish
                  </Button>
                </>
              )}
              {!data.roles.includes('ADMIN') && data.status !== 'DELETED' && (
                <Button
                  size="sm"
                  className="gm-btn-chip gm-btn-chip--accent"
                  loading={openChat.isPending}
                  onClick={() => openChat.mutate(data.id, { onSuccess: (conversation) => navigate(`/admin/xabarlar?suhbat=${conversation.id}`) })}
                >
                  <MessageCircle size={16} /> Chat orqali yozish
                </Button>
              )}
              <Link to={`/admin/audit?actor=${data.accountNumber}`}>
                <Button size="sm" variant="secondary">
                  Audit jurnali
                </Button>
              </Link>
            </div>
          </header>

          <section className="gm-uprofile__stats" aria-label="Statistika">
            <Stat icon={<Package size={18} />} value={data.stats.orders} label="Buyurtmalar" />
            <Stat icon={<Wrench size={18} />} value={data.stats.requests} label="So‘rovlar" />
            <Stat icon={<MessageSquare size={18} />} value={data.stats.messages} label="Xabarlar" />
            <Stat icon={<Smartphone size={18} />} value={data.stats.activeDevices} label="Faol qurilmalar" />
            {data.masterProfile && <Stat icon={<Star size={18} />} value={Number(data.masterProfile.ratingAvg).toFixed(1)} label={`Reyting · ${data.masterProfile.completedOrders} ish`} />}
          </section>

          <div className="gm-uprofile__grid">
            <section className="gm-uprofile__card">
              <h2>Aloqa va akkaunt</h2>
              <Field icon={<Phone size={16} />} label="Telefon">
                {data.phone}
                {data.phoneVerifiedAt ? ' · tasdiqlangan' : ' · tasdiqlanmagan'}
              </Field>
              <Field icon={<KeyRound size={16} />} label="Kirish ma’lumotlari">
                <span className="gm-cred">
                  <span className="gm-cred__row">
                    <span className="gm-cred__key">Login</span>
                    <strong className="gm-cred__value">{data.phone}</strong>
                    <span className="gm-cred__tools">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gm-btn-chip"
                        onClick={() => {
                          void navigator.clipboard?.writeText(data.phone);
                          setLoginCopied(true);
                          window.setTimeout(() => setLoginCopied(false), 1500);
                        }}
                      >
                        {loginCopied ? <Check size={15} /> : <Copy size={15} />} {loginCopied ? 'Nusxalandi' : 'Nusxalash'}
                      </Button>
                    </span>
                  </span>
                  <span className="gm-cred__row">
                    <span className="gm-cred__key">Parol</span>
                    <span className="gm-cred__value">
                      <strong className="gm-cred__dots">••••••••••</strong>
                    </span>
                    {!data.roles.includes('ADMIN') && data.status !== 'DELETED' && (
                      <span className="gm-cred__tools">
                        <Button size="sm" className="gm-btn-chip gm-btn-chip--accent" onClick={() => setPasswordOpen(true)}>
                          <KeyRound size={15} /> Yangi parol belgilash
                        </Button>
                      </span>
                    )}
                  </span>
                  <small className="gm-cred__note">
                    Parol faqat xeshlangan (qaytarib bo‘lmaydigan) ko‘rinishda saqlanadi — uni hech kim, jumladan administrator ham ko‘ra olmaydi. Faqat yangisini belgilash mumkin; bunda foydalanuvchi barcha qurilmalardan chiqariladi.
                  </small>
                </span>
              </Field>
              <Field icon={<Mail size={16} />} label="Email">
                {data.email ?? '—'}
              </Field>
              <Field icon={<CalendarClock size={16} />} label="Ro‘yxatdan o‘tgan">
                {formatDateTime(data.createdAt)}
              </Field>
              <Field icon={<CalendarClock size={16} />} label="Oxirgi kirish">
                {data.lastLoginAt ? `${formatDateTime(data.lastLoginAt)} · ${formatRelativeTime(data.lastLoginAt)}` : '—'}
              </Field>
              {data.lastSession && (
                <Field icon={<Smartphone size={16} />} label="Oxirgi qurilma">
                  {data.lastSession.panel && `${data.lastSession.panel} paneli · `}
                  {data.lastSession.ipAddress ?? 'IP noma’lum'}
                  {data.lastSession.userAgent && <small className="gm-uprofile__ua">{data.lastSession.userAgent}</small>}
                </Field>
              )}
            </section>

            {data.masterProfile && (
              <section className="gm-uprofile__card">
                <h2>Usta profili</h2>
                <Field icon={<Wrench size={16} />} label="Kasbi">
                  {data.masterProfile.profession ?? '—'}
                  {data.masterProfile.experienceYears != null && ` · ${data.masterProfile.experienceYears} yil tajriba`}
                </Field>
                <Field icon={<ShieldCheck size={16} />} label="Holati">
                  <span className="gm-uprofile__inline">
                    {data.masterExtra?.isPaused ? 'Pauzada' : statusLabel(data.masterProfile.status)}
                    <TrustBadge verification={data.masterProfile.verification} />
                  </span>
                </Field>
                {data.masterProfile.bio && <p className="gm-uprofile__bio">{data.masterProfile.bio}</p>}
                {data.masterExtra && (
                  <>
                    <Field icon={<Star size={16} />} label="Reyting va sharhlar">
                      {Number(data.masterProfile.ratingAvg).toFixed(1)} · {data.masterExtra.ratingCount} ta sharh
                    </Field>
                    <Field icon={<ShieldCheck size={16} />} label="Ishonchlilik">
                      Yakunlash {Math.round(Number(data.masterExtra.completionRate))}% · Javob berish {Math.round(Number(data.masterExtra.responseRate))}%
                    </Field>
                    <Field icon={<Building2 size={16} />} label="Ish joyi">
                      {data.masterExtra.workPlace || '—'}
                    </Field>
                    <Field icon={<MapPin size={16} />} label="Ish hududi">
                      {Array.isArray(data.masterExtra.serviceAreas) && data.masterExtra.serviceAreas.length > 0 ? (data.masterExtra.serviceAreas as string[]).join(', ') : '—'}
                      {data.masterExtra.workRadiusKm ? <small className="gm-uprofile__ua">Ish radiusi: {Number(data.masterExtra.workRadiusKm)} km</small> : <small className="gm-uprofile__ua">Radius belgilanmagan</small>}
                    </Field>
                    {data.masterExtra.services.length > 0 && (
                      <div className="gm-uprofile__services">
                        <span className="gm-uprofile__services-title">Xizmatlari</span>
                        <ul className="gm-uprofile__tags" aria-label="Xizmatlari">
                          {data.masterExtra.services.map((service) => (
                            <li key={service.name}>
                              {service.name}
                              {service.basePrice && ` · ${formatMoney(service.basePrice)}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                <Link to="/admin/tasdiqlash" className="gm-uprofile__link">
                  Tasdiqlash hujjatlari →
                </Link>
              </section>
            )}

            {data.addresses && data.addresses.length > 0 && (
              <section className="gm-uprofile__card">
                <h2>Manzillari</h2>
                {data.addresses.map((address) => (
                  <Field key={address.id} icon={<MapPin size={16} />} label={`${address.title ?? 'Manzil'}${address.isDefault ? ' · asosiy' : ''}`}>
                    {[address.addressLine, address.district, address.city].filter(Boolean).join(', ')}
                  </Field>
                ))}
              </section>
            )}

            {data.recentOrders && data.recentOrders.length > 0 && (
              <section className="gm-uprofile__card">
                <h2>Oxirgi buyurtmalar</h2>
                <ul className="gm-uprofile__orders">
                  {data.recentOrders.map((order) => (
                    <li key={order.id}>
                      <Link to={`/admin/buyurtmalar/${order.id}`} className="gm-order-card" aria-label={`Buyurtma №${order.orderNumber} — ${statusLabel(order.status)}`}>
                        <span className="gm-order-card__head">
                          <strong className="gm-order-card__no">№{order.orderNumber}</strong>
                          <Badge tone="neutral">{order.side === 'MASTER' ? 'Usta sifatida' : 'Mijoz sifatida'}</Badge>
                        </span>
                        <span className={`gm-order-card__status gm-order-card__status--${orderTone(order.status)}`}>{statusLabel(order.status)}</span>
                        <span className="gm-order-card__foot">
                          <strong>{formatMoney(order.finalAmount, order.currency)}</strong>
                          <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
                        </span>
                        <ChevronRight className="gm-order-card__arrow" size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section className="gm-uprofile__card">
            <h2>So‘nggi faollik</h2>
            {data.recentActivity.length === 0 ? (
              <EmptyState title="Faollik yo‘q" />
            ) : (
              <ul className="gm-uprofile__activity">
                {data.recentActivity.map((entry) => {
                  const info = actionInfo(entry.action);
                  return (
                    <li key={entry.id}>
                      <Badge tone={info.tone}>{info.label}</Badge>
                      {entry.actor && entry.actor.accountNumber !== data.accountNumber && (
                        <Link to={accountPath(entry.actor.accountNumber, me.data?.accountNumber)} className="gm-uprofile__link">
                          bajaruvchi profili
                        </Link>
                      )}
                      {entry.reason && <span className="gm-uprofile__reason">Sabab: {entry.reason}</span>}
                      <time>{formatDateTime(entry.createdAt)}</time>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
      {data && passwordOpen && <PasswordResetDialog userId={data.id} name={accountName(data)} phone={data.phone} onClose={() => setPasswordOpen(false)} />}
      {data && action && <UserActionDialog
          user={data as AdminUser}
          action={action}
          onClose={() => setAction(null)}
          // O‘chirilgach profil yopiladi; akkaunt «O‘chirilgan» ro‘yxatida qoladi.
          onDeleted={() => navigate('/admin/foydalanuvchilar?status=DELETED', { replace: true })}
        />}
    </div>
  );
}
