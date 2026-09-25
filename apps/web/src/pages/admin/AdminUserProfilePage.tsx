import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Mail, MessageSquare, Package, Phone, ShieldCheck, Smartphone, Star, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { useAdminUser } from '@/features/admin/hooks/useAdmin';
import { accountPath } from '@/features/admin/components/AccountLink';
import { actionInfo } from '@/features/admin/audit-labels';
import { useMe } from '@/features/session/hooks/useMe';
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
  const user = useAdminUser(id);

  // O‘z akkaunti bo‘lsa — shaxsiy profil bo‘limiga.
  if (id && me.data?.id === id) return <Navigate to="/sozlamalar" replace />;

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
              <Link to={`/admin/audit?actor=${data.id}`}>
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
                  {data.masterProfile.status}
                </Field>
                {data.masterProfile.bio && <p className="gm-uprofile__bio">{data.masterProfile.bio}</p>}
                <Link to="/admin/tasdiqlash" className="gm-uprofile__link">
                  Tasdiqlash hujjatlari →
                </Link>
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
                      {entry.actorId && entry.actorId !== data.id && (
                        <Link to={accountPath(entry.actorId, me.data?.id)} className="gm-uprofile__link">
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
    </div>
  );
}
