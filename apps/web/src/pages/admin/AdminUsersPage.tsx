import { useState } from 'react';
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

const STATUS: Record<ManagedStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Akkaunt faol', tone: 'success' },
  PENDING: { label: 'Telefon tasdiqlanmagan', tone: 'neutral' },
  SUSPENDED: { label: 'Akkaunt muzlatilgan', tone: 'warning' },
  BLOCKED: { label: 'Akkaunt bloklangan', tone: 'danger' },
  DELETED: { label: 'O‘chirilgan', tone: 'neutral' },
};

const ROLE_TABS: Array<{ value: UserFilters['role'] | ''; label: string }> = [
  { value: '', label: 'Hammasi' },
  { value: 'CUSTOMER', label: 'Mijozlar' },
  { value: 'MASTER', label: 'Ustalar' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Barcha holatlar' },
  ...(Object.keys(STATUS) as ManagedStatus[]).map((value) => ({ value, label: STATUS[value].label })),
];

function masterWorkState(user: AdminUser): { label: string; tone: BadgeTone } | null {
  const profile = user.masterProfile;
  if (!profile) return null;
  if (user.status === 'SUSPENDED' || user.status === 'BLOCKED' || user.status === 'DELETED') return { label: 'Usta: cheklangan', tone: 'danger' };
  if (profile.verification !== 'VERIFIED') return { label: 'Usta: nofaol', tone: 'neutral' };
  if (profile.status === 'ACTIVE') return { label: 'Usta: faol', tone: 'success' };
  if (profile.status === 'BUSY') return { label: 'Usta: band', tone: 'warning' };
  if (profile.status === 'RESTRICTED' || profile.status === 'SUSPENDED') return { label: 'Usta: cheklangan', tone: 'danger' };
  return { label: 'Usta: nofaol', tone: 'neutral' };
}

function UserCard({ user, onAction }: { user: AdminUser; onAction: (user: AdminUser, action: UserAction) => void }) {
  const restricted = user.status === 'SUSPENDED' || user.status === 'BLOCKED';
  const deleted = user.status === 'DELETED';
  const workState = masterWorkState(user);

  return (
    <div className="gm-card gm-user-card">
      <div className="gm-user-card__main">
        <span className="gm-avatar" aria-hidden="true">
          {initials(displayName(user))}
        </span>
        <div className="gm-user-card__info">
          <div className="gm-user-card__title">
            <h3>{displayName(user)}</h3>
            {user.roles.includes('CUSTOMER') && <Badge tone="primary">Mijoz</Badge>}
            {user.roles.includes('MASTER') && <Badge tone="primary">Usta</Badge>}
            <Badge tone={STATUS[user.status].tone}>{STATUS[user.status].label}</Badge>
            {workState && <Badge tone={workState.tone}>{workState.label}</Badge>}
          </div>
          <p className="gm-card__meta">
            ID {user.accountNumber} · {user.phone}
            {user.email && ` · ${user.email}`} · Ro‘yxatdan o‘tgan: {formatDateTime(user.createdAt)}
          </p>
          {user.masterProfile && (
            <p className="gm-card__meta gm-user-card__master">
              {user.masterProfile.profession ?? 'Kasb ko‘rsatilmagan'} ·{' '}
              <TrustBadge verification={user.masterProfile.verification} /> · Reyting{' '}
              {Number(user.masterProfile.ratingAvg).toFixed(1)} · {user.masterProfile.completedOrders} ta ish
            </p>
          )}
          <p className="gm-card__meta">ID: {user.id}</p>
        </div>
      </div>

      {!deleted && (
        <div className="gm-action-row">
          {restricted ? (
            <Button size="sm" onClick={() => onAction(user, 'ACTIVATE')}>
              <CheckCircle2 size={16} /> Faollashtirish
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => onAction(user, 'SUSPEND')}>
                <Snowflake size={16} /> Muzlatish
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onAction(user, 'BLOCK')}>
                <Ban size={16} /> Bloklash
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => onAction(user, 'DELETE')}>
            <Trash2 size={16} /> O‘chirish
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const [role, setRole] = useState<UserFilters['role'] | ''>('');
  const [status, setStatus] = useState<ManagedStatus | ''>('');
  const [search, setSearch] = useState('');
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
          <h1>Foydalanuvchilar</h1>
          <p className="gm-page-lead">Mijozlar va ustalarni boshqaring.</p>
        </div>
      </div>

      <div className="gm-tabs" role="tablist" aria-label="Rol bo‘yicha">
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
            label="Qidirish"
            placeholder="Ism, familiya yoki telefon"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
          />
        </div>
        <Select label="Holat" options={STATUS_OPTIONS} value={status} onChange={(event) => setStatus(event.target.value as ManagedStatus | '')} />
      </div>

      {users.isLoading && <PageLoader label="Foydalanuvchilar yuklanmoqda…" />}
      {users.isError && <Alert tone="danger">{getErrorMessage(users.error)}</Alert>}
      {users.data && items.length === 0 && (
        <EmptyState icon={<Search size={28} />} title="Foydalanuvchi topilmadi" description="Qidiruv yoki filtrni o‘zgartirib ko‘ring." />
      )}

      <div className="gm-list">
        {items.map((user) => (
          <UserCard key={user.id} user={user} onAction={(target, action) => setDialog({ user: target, action })} />
        ))}
      </div>

      {users.hasNextPage && (
        <div style={{ marginTop: 'var(--gm-space-4)', textAlign: 'center' }}>
          <Button variant="secondary" loading={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
            Yana yuklash
          </Button>
        </div>
      )}

      {dialog && <UserActionDialog user={dialog.user} action={dialog.action} onClose={() => setDialog(null)} />}
    </div>
  );
}
