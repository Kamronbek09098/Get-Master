import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, CheckCircle2, Search, Snowflake, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, initials } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { useAdminUsers } from '@/features/admin/hooks/useAdmin';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { displayName } from '@/features/admin/user-actions';
import type { UserAction } from '@/features/admin/user-actions';
import type { AdminUser, ManagedStatus, UserFilters } from '@/features/admin/types';
import { t } from '@/i18n';

const STATUS: Record<ManagedStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: t('Akkaunt faol'), tone: 'success' },
  PENDING: { label: t('Telefon tasdiqlanmagan'), tone: 'neutral' },
  SUSPENDED: { label: t('Akkaunt muzlatilgan'), tone: 'warning' },
  BLOCKED: { label: t('Akkaunt bloklangan'), tone: 'danger' },
  DELETED: { label: t('O‘chirilgan'), tone: 'neutral' },
};

const ROLE_TABS: Array<{ value: UserFilters['role'] | ''; label: string }> = [
  { value: '', label: t('Hammasi') },
  { value: 'CUSTOMER', label: t('Mijozlar') },
  { value: 'MASTER', label: t('Ustalar') },
];

const STATUS_OPTIONS = [
  { value: '', label: t('Barcha holatlar') },
  ...(Object.keys(STATUS) as ManagedStatus[]).map((value) => ({ value, label: STATUS[value].label })),
];

function masterWorkState(user: AdminUser): { label: string; tone: BadgeTone } | null {
  const profile = user.masterProfile;
  if (!profile) return null;
  if (user.status === 'SUSPENDED' || user.status === 'BLOCKED' || user.status === 'DELETED') return { label: t('Usta: cheklangan'), tone: 'danger' };
  if (profile.verification !== 'VERIFIED') return { label: t('Usta: nofaol'), tone: 'neutral' };
  if (profile.status === 'ACTIVE') return { label: t('Usta: faol'), tone: 'success' };
  if (profile.status === 'BUSY') return { label: t('Usta: band'), tone: 'warning' };
  if (profile.status === 'RESTRICTED' || profile.status === 'SUSPENDED') return { label: t('Usta: cheklangan'), tone: 'danger' };
  return { label: t('Usta: nofaol'), tone: 'neutral' };
}

function UserCard({ user, onAction }: { user: AdminUser; onAction: (user: AdminUser, action: UserAction) => void }) {
  const restricted = user.status === 'SUSPENDED' || user.status === 'BLOCKED';
  const deleted = user.status === 'DELETED';
  const isAdmin = user.roles.includes('ADMIN');
  const workState = masterWorkState(user);
  const navigate = useNavigate();
  const profilePath = `/admin/foydalanuvchilar/${user.accountNumber}`;

  return (
    <div
      className="gm-card gm-card--clickable gm-user-card"
      role="link"
      tabIndex={0}
      aria-label={t('{displayName} profilini ochish', { displayName: displayName(user) })}
      onClick={() => navigate(profilePath)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        navigate(profilePath);
      }}
    >
      <div className="gm-user-card__main gm-user-card__link">
        <span className="gm-avatar" aria-hidden="true">
          {initials(displayName(user))}
        </span>
        <div className="gm-user-card__info">
          <div className="gm-user-card__title">
            <h3>{displayName(user)}</h3>
            {user.roles.includes('CUSTOMER') && <Badge tone="primary">{t('Mijoz')}</Badge>}
            {user.roles.includes('MASTER') && <Badge tone="primary">{t('Usta')}</Badge>}
            {isAdmin && <Badge tone="warning">{t('Admin')}</Badge>}
            <Badge tone={STATUS[user.status].tone}>{STATUS[user.status].label}</Badge>
            {workState && <Badge tone={workState.tone}>{workState.label}</Badge>}
          </div>
          <p className="gm-card__meta">{t('ID {accountNumber} · {phone} {p} · Ro‘yxatdan o‘tgan: {dateTime}', { accountNumber: user.accountNumber, phone: user.phone, p: user.email && ` · ${user.email}`, dateTime: formatDateTime(user.createdAt) })}</p>
          {user.masterProfile && (
            <p className="gm-card__meta gm-user-card__master">
              {user.masterProfile.profession ?? t('Kasb ko‘rsatilmagan')} ·{' '}
              <TrustBadge verification={user.masterProfile.verification} />{' '}{t('· Reyting {toFixed} · {completedOrders} ta ish', { toFixed: Number(user.masterProfile.ratingAvg).toFixed(1), completedOrders: user.masterProfile.completedOrders })}</p>
          )}
        </div>
      </div>

      {isAdmin && (
        <p className="gm-card__meta">{t('Admin akkauntlarni bu yerdan muzlatish, bloklash yoki o‘chirish mumkin emas.')}</p>
      )}

      {!deleted && !isAdmin && (
        <div className="gm-action-row" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          {restricted ? (
            <Button size="sm" onClick={() => onAction(user, 'ACTIVATE')}>
              <CheckCircle2 size={16} />{' '}{t('Faollashtirish')}</Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => onAction(user, 'SUSPEND')}>
                <Snowflake size={16} />{' '}{t('Muzlatish')}</Button>
              <Button size="sm" variant="secondary" onClick={() => onAction(user, 'BLOCK')}>
                <Ban size={16} />{' '}{t('Bloklash')}</Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => onAction(user, 'DELETE')}>
            <Trash2 size={16} />{' '}{t('O‘chirish')}</Button>
        </div>
      )}
    </div>
  );
}

const VALID_ROLES = new Set(['CUSTOMER', 'MASTER']);

export function AdminUsersPage() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role');
  const [role, setRole] = useState<UserFilters['role'] | ''>(
    initialRole && VALID_ROLES.has(initialRole) ? (initialRole as UserFilters['role']) : '',
  );
  const [status, setStatus] = useState<ManagedStatus | ''>(searchParams.get('status') === 'DELETED' ? 'DELETED' : '');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [dialog, setDialog] = useState<{ user: AdminUser; action: UserAction } | null>(null);

  const users = useAdminUsers({
    role: role || undefined,
    status: status || undefined,
    search: debouncedSearch || undefined,
  });
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Foydalanuvchilar')}</h1>
          <p className="gm-page-lead">{t('Mijozlar va ustalarni boshqaring.')}</p>
        </div>
      </div>

      <div className="gm-tabs" role="tablist" aria-label={t('Rol bo‘yicha')}>
        {ROLE_TABS.map((tab) => (
          <Button
            key={tab.label}
            size="sm"
            role="tab"
            aria-selected={role === tab.value}
            variant={role === tab.value ? 'primary' : 'secondary'}
            onClick={() => setRole(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="gm-toolbar">
        <div style={{ flex: '1 1 260px' }}>
          <Input
            label={t('Qidirish')}
            placeholder={t('Ism, familiya, telefon yoki ID')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
          />
        </div>
        <Select label={t('Holat')} options={STATUS_OPTIONS} value={status} onChange={(event) => setStatus(event.target.value as ManagedStatus | '')} />
      </div>

      {users.isLoading && <PageLoader label={t('Foydalanuvchilar yuklanmoqda…')} />}
      {users.isError && <Alert tone="danger">{getErrorMessage(users.error)}</Alert>}
      {users.data && items.length === 0 && (
        <EmptyState icon={<Search size={28} />} title={t('Foydalanuvchi topilmadi')} description={t('Qidiruv yoki filtrni o‘zgartirib ko‘ring.')} />
      )}

      <div className="gm-list">
        {items.map((user) => (
          <UserCard key={user.id} user={user} onAction={(target, action) => setDialog({ user: target, action })} />
        ))}
      </div>

      {users.hasNextPage && (
        <div style={{ marginTop: 'var(--gm-space-4)', textAlign: 'center' }}>
          <Button variant="secondary" loading={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>{t('Yana yuklash')}</Button>
        </div>
      )}

      {dialog && <UserActionDialog user={dialog.user} action={dialog.action} onClose={() => setDialog(null)} />}
    </div>
  );
}
