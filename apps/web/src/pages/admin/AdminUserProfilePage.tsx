import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Ban, CheckCircle2, MapPin, Snowflake, Trash2, ArrowLeft, CalendarClock, Mail, MessageSquare, Package, Phone, ShieldCheck, Smartphone, Star, Wrench } from 'lucide-react';
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
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
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
  const number = id && /^\d{1,9}$/.test(id) ? Number(id) : null;
  const user = useAdminUserByNumber(number);

  // O‘z akkaunti bo‘lsa — shaxsiy profil bo‘limiga.
  if (number !== null && me.data?.accountNumber === number) return <Navigate to="/sozlamalar" replace />;

  const data = user.data;
  const status = data ? (STATUS[data.status] ?? { label: data.status, tone: 'neutral' as BadgeTone }) : null;

  return (
    <div className="gm-uprofile">
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
                {data.masterProfile && <TrustBadge verification={data.masterProfile.verification} />}
              </div>
            </div>
            <div className="gm-uprofile__actions">
              {!data.roles.includes('ADMIN') && data.status !== 'DELETED' && (
                <>
                  {data.status === 'SUSPENDED' || data.status === 'BLOCKED' ? (
                    <Button size="sm" onClick={() => setAction('ACTIVATE')}>
                      <CheckCircle2 size={16} /> Faollashtirish
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setAction('SUSPEND')}>
                        <Snowflake size={16} /> Muzlatish
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setAction('BLOCK')}>
                        <Ban size={16} /> Bloklash
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setAction('DELETE')}>
                    <Trash2 size={16} /> O‘chirish
                  </Button>
                </>
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
                  {statusLabel(data.masterProfile.status)}
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
                    <Field icon={<MapPin size={16} />} label="Ish hududi">
                      {data.masterExtra.workRadiusKm ? `${Number(data.masterExtra.workRadiusKm)} km` : '—'}
                      {Array.isArray(data.masterExtra.serviceAreas) && data.masterExtra.serviceAreas.length > 0 && ` · ${(data.masterExtra.serviceAreas as string[]).join(', ')}`}
                      {data.masterExtra.isPaused && ' · pauzada'}
                    </Field>
                    {data.masterExtra.services.length > 0 && (
                      <ul className="gm-uprofile__tags" aria-label="Xizmatlari">
                        {data.masterExtra.services.map((service) => (
                          <li key={service.name}>
                            {service.name}
                            {service.basePrice && ` · ${formatMoney(service.basePrice)}`}
                          </li>
                        ))}
                      </ul>
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
                      <Link to={`/admin/buyurtmalar/${order.id}`} className="gm-uprofile__link">
                        №{order.orderNumber}
                      </Link>
                      <Badge tone="neutral">{order.side === 'MASTER' ? 'Usta sifatida' : 'Mijoz sifatida'}</Badge>
                      <span>{statusLabel(order.status)}</span>
                      <strong>{formatMoney(order.finalAmount, order.currency)}</strong>
                      <time>{formatDateTime(order.createdAt)}</time>
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
      {data && action && <UserActionDialog user={data as AdminUser} action={action} onClose={() => setAction(null)} />}
    </div>
  );
}
