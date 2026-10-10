import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Crown, ExternalLink, Gift, Mail, Phone, Snowflake, Trash2, UserCheck, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { useAdminUserByNumber } from '@/features/admin/hooks/useAdmin';
import { useMe } from '@/features/session/hooks/useMe';
import type { UserAction } from '@/features/admin/user-actions';
import type { AdminUser } from '@/features/admin/types';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { statusLabel } from '@/lib/labels';
import { cx, formatDate, formatDateTime, formatMoney, formatRelativeTime } from '@/lib/utils';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { UserSubscriptionDialog } from './UserSubscriptionDialog';
import { USER_STATUS } from './users-ui';
import './UserDrawer.css';
import { t } from '@/i18n';

type Tab = 'info' | 'orders' | 'subscription';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-udr__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Foydalanuvchi ro‘yxatidagi qatorni bosganda ochiladigan o‘ng panel: ma’lumot, buyurtmalar, obuna va tezkor amallar. */
export function UserDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const navigate = useNavigate();
  const me = useMe();
  const detail = useAdminUserByNumber(user.accountNumber);
  const [tab, setTab] = useState<Tab>('info');
  const [action, setAction] = useState<UserAction | null>(null);
  const [granting, setGranting] = useState(false);

  useEffect(() => setTab('info'), [user.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !action && !granting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, action, granting]);

  const d = detail.data;
  const status = USER_STATUS[(d?.status ?? user.status) as keyof typeof USER_STATUS];
  const name = accountName(d ?? user);
  const roles = d?.roles ?? user.roles;
  const isAdmin = roles.includes('ADMIN');
  const restricted = (d?.status ?? user.status) === 'SUSPENDED' || (d?.status ?? user.status) === 'BLOCKED';
  const deleted = (d?.status ?? user.status) === 'DELETED';
  const canSubscribe = !!me.data?.isSuperAdmin || !!me.data?.adminPermissions?.includes('SUBSCRIPTIONS');
  const subscription = d?.subscription ?? user.subscription ?? null;
  const master = d?.masterProfile ?? user.masterProfile;
  const phone = d?.phone ?? user.phone;
  const email = d?.email ?? user.email;
  const ratingCount = d?.masterExtra?.ratingCount ?? user.masterProfile?.ratingCount;
  const history = d?.subscriptionHistory ?? [];
  const ordersTotal = d?.stats.orders ?? user.ordersCount ?? 0;

  return (
    <>
      <div className="gm-udr__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="gm-udr" role="dialog" aria-modal="true" aria-label={t('Foydalanuvchi: {name}', { name })}>
        <header className="gm-udr__head">
          <ChatAvatar name={name} seed={user.id} size="lg" src={d?.avatar ?? user.avatar} />
          <div className="gm-udr__who">
            <h2>{name}</h2>
            <div className="gm-udr__badges">
              {status && <Badge tone={status.tone}>{status.label}</Badge>}
              {roles.includes('CUSTOMER') && <Badge tone="primary">{t('Mijoz')}</Badge>}
              {roles.includes('MASTER') && <Badge tone="primary">{t('Usta')}</Badge>}
            </div>
            <p><Phone size={13} aria-hidden="true" /> {phone}</p>
            {email && <p><Mail size={13} aria-hidden="true" /> {email}</p>}
            <p className="gm-udr__id">ID {user.accountNumber}</p>
          </div>
          <button type="button" className="gm-udr__close" onClick={onClose} aria-label={t('Yopish')}>
            <X size={18} />
          </button>
        </header>

        <div className="gm-udr__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'info'} className={cx(tab === 'info' && 'is-on')} onClick={() => setTab('info')}>{t('Asosiy ma’lumot')}</button>
          <button type="button" role="tab" aria-selected={tab === 'orders'} className={cx(tab === 'orders' && 'is-on')} onClick={() => setTab('orders')}>{t('Buyurtmalar ({count})', { count: ordersTotal })}</button>
          <button type="button" role="tab" aria-selected={tab === 'subscription'} className={cx(tab === 'subscription' && 'is-on')} onClick={() => setTab('subscription')}>{t('Obuna')}</button>
        </div>

        <div className="gm-udr__body">
          {detail.isError && <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>}

          {tab === 'info' && (
            <>
              <section className="gm-udr__card">
                <h3>{t('Profil ma’lumotlari')}</h3>
                <Info label={t('To‘liq ism')}>{name}</Info>
                <Info label={t('Telefon')}>{phone}</Info>
                <Info label={t('Email')}>{email ?? '—'}</Info>
                <Info label={t('Ro‘yxatdan o‘tgan')}>{formatDate(user.createdAt)} <small>({formatRelativeTime(user.createdAt)})</small></Info>
                <Info label={t('Oxirgi faollik')}>{(d?.lastLoginAt ?? user.lastLoginAt) ? formatRelativeTime((d?.lastLoginAt ?? user.lastLoginAt) as string) : t('Hali kirmagan')}</Info>
                <Info label={t('Telefon holati')}>{(d?.phoneVerifiedAt ?? user.phoneVerifiedAt) ? t('Tasdiqlangan') : t('Tasdiqlanmagan')}</Info>
                <Info label="ID">{user.accountNumber}</Info>
              </section>

              {master && (
                <section className="gm-udr__card">
                  <h3>{t('Usta profili')}</h3>
                  <Info label={t('Kasb')}>{master.profession ?? '—'}</Info>
                  <Info label={t('Tasdiq')}><TrustBadge verification={master.verification} /></Info>
                  <Info label={t('Reyting')}>{Number(master.ratingAvg) > 0 ? `★ ${Number(master.ratingAvg).toFixed(1)}${ratingCount ? ` (${ratingCount})` : ''}` : '—'}</Info>
                  <Info label={t('Bajarilgan ishlar')}>{master.completedOrders}</Info>
                </section>
              )}

              <section className="gm-udr__card gm-udr__plan">
                <h3>{t('Obuna rejasi')}</h3>
                {subscription ? (
                  <>
                    <div className="gm-udr__planhead">
                      <span className="gm-udr__crown"><Crown size={20} aria-hidden="true" /></span>
                      <strong>{subscription.planName}</strong>
                      <Badge tone="success">{t('Faol')}</Badge>
                    </div>
                    <Info label={t('Tugash sanasi')}>{formatDate(subscription.endsAt)} <small>({t('{days} kun qoldi', { days: subscription.daysLeft })})</small></Info>
                  </>
                ) : (
                  <p className="gm-udr__muted">{t('Faol obuna yo‘q (bepul reja).')}</p>
                )}
                {canSubscribe && !isAdmin && !deleted && (
                  <Button fullWidth variant={subscription ? 'primary' : 'secondary'} onClick={() => setGranting(true)}>
                    <Gift size={16} aria-hidden="true" /> {subscription ? t('Obunani uzaytirish') : t('Obuna berish')}
                  </Button>
                )}
              </section>

              <section className="gm-udr__card">
                <h3>{t('Amallar')}</h3>
                <div className="gm-udr__actions">
                  <Button variant="secondary" onClick={() => navigate(`/admin/foydalanuvchilar/${user.accountNumber}`)}><ExternalLink size={16} aria-hidden="true" /> {t('Profilni ko‘rish')}</Button>
                  {!isAdmin && !deleted && (restricted ? (
                    <Button variant="secondary" onClick={() => setAction('ACTIVATE')}><UserCheck size={16} aria-hidden="true" /> {t('Faollashtirish')}</Button>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => setAction('SUSPEND')}><Snowflake size={16} aria-hidden="true" /> {t('Muzlatish')}</Button>
                      <Button variant="secondary" className="gm-udr__danger" onClick={() => setAction('BLOCK')}><Ban size={16} aria-hidden="true" /> {t('Bloklash')}</Button>
                    </>
                  ))}
                  {!isAdmin && !deleted && <Button variant="secondary" className="gm-udr__danger" onClick={() => setAction('DELETE')}><Trash2 size={16} aria-hidden="true" /> {t('O‘chirish')}</Button>}
                </div>
              </section>
            </>
          )}

          {tab === 'orders' && (
            <section className="gm-udr__card">
              <h3>{t('So‘nggi buyurtmalar')}</h3>
              {detail.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
              {d && (d.recentOrders ?? []).length === 0 && <p className="gm-udr__muted">{t('Hali buyurtma yo‘q.')}</p>}
              {(d?.recentOrders ?? []).map((order) => (
                <button key={order.id} type="button" className="gm-udr__order" onClick={() => navigate(`/admin/buyurtmalar/${order.id}`)}>
                  <span>
                    <strong>№{order.orderNumber}</strong>
                    <small>{formatDateTime(order.createdAt)} · {order.side === 'MASTER' ? t('Usta sifatida') : t('Mijoz sifatida')}</small>
                  </span>
                  <span className="gm-udr__orderside">
                    <b>{formatMoney(order.finalAmount, order.currency)}</b>
                    <Badge tone="neutral">{statusLabel(order.status)}</Badge>
                  </span>
                </button>
              ))}
              {d && ordersTotal > (d.recentOrders ?? []).length && <p className="gm-udr__muted">{t('Jami {count} ta buyurtma; oxirgi 5 tasi ko‘rsatilgan.', { count: ordersTotal })}</p>}
            </section>
          )}

          {tab === 'subscription' && (
            <section className="gm-udr__card">
              <h3>{t('Obuna tarixi')}</h3>
              {detail.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
              {d && history.length === 0 && <p className="gm-udr__muted">{t('Obuna tarixi yo‘q.')}</p>}
              {history.map((row) => (
                <div key={row.id} className="gm-udr__sub">
                  <span>
                    <strong>{row.planName}</strong>
                    <small>{row.months === 12 ? t('1 yil') : t('{months} oy', { months: row.months })} · {row.source === 'GRANT' ? t('Sovg‘a') : formatMoney(row.amount, row.currency)}</small>
                    <small>{row.startsAt && row.endsAt ? `${formatDate(row.startsAt)} — ${formatDate(row.endsAt)}` : formatDateTime(row.createdAt)}</small>
                  </span>
                  <Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'PENDING' ? 'warning' : 'neutral'}>{statusLabel(row.status)}</Badge>
                </div>
              ))}
              {canSubscribe && !isAdmin && !deleted && (
                <Button fullWidth onClick={() => setGranting(true)}><Gift size={16} aria-hidden="true" /> {subscription ? t('Obunani uzaytirish') : t('Obuna berish')}</Button>
              )}
            </section>
          )}
        </div>
      </aside>

      {action && <UserActionDialog user={user} action={action} onClose={() => setAction(null)} onDeleted={() => { setAction(null); onClose(); }} />}
      {granting && <UserSubscriptionDialog user={d ?? user} onClose={() => setGranting(false)} />}
    </>
  );
}
