import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Ban, CheckCircle2, KeyRound, ListChecks, ShieldCheck, ShieldOff, Snowflake, Trash2, UserPlus } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { CreateAdminDialog } from '@/features/admin/components/CreateAdminDialog';
import { AdminPermissionsDialog } from '@/features/admin/components/AdminPermissionsDialog';
import { PERMISSION_LABEL } from '@/features/admin/permissions';
import { PasswordResetDialog } from '@/features/admin/components/PasswordResetDialog';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { useAdminAccounts, useSetSuperAdmin } from '@/features/admin/hooks/useAdmin';
import type { UserAction } from '@/features/admin/user-actions';
import type { AdminAccount, AdminUser } from '@/features/admin/types';
import { useMe } from '@/features/session/hooks/useMe';
import './AdminAdminsPage.css';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Faol', tone: 'success' },
  SUSPENDED: { label: 'Muzlatilgan', tone: 'warning' },
  BLOCKED: { label: 'Bloklangan', tone: 'danger' },
  PENDING: { label: 'Tasdiqlanmagan', tone: 'neutral' },
};

const nameOf = (admin: AdminAccount) => [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.phone;

/** «Dialog» komponentlari kutadigan AdminUser ko‘rinishiga keltiradi. */
const asUser = (admin: AdminAccount): AdminUser => ({
  id: admin.id,
  accountNumber: admin.accountNumber,
  phone: admin.phone,
  email: null,
  firstName: admin.firstName,
  lastName: admin.lastName,
  status: admin.status,
  createdAt: admin.createdAt,
  deletedAt: null,
  roles: ['ADMIN'],
  masterProfile: null,
});

/** Superadmin paneli: adminlarni yaratish va boshqarish. */
export function AdminAdminsPage() {
  const me = useMe();
  const isSuper = !!me.data?.isSuperAdmin;
  const admins = useAdminAccounts(isSuper);
  const setSuper = useSetSuperAdmin();
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<{ admin: AdminAccount; action: UserAction } | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminAccount | null>(null);
  const [permissionsFor, setPermissionsFor] = useState<AdminAccount | null>(null);

  if (me.isLoading) return <PageLoader />;
  if (!isSuper) return <Navigate to="/admin" replace />;
  const items = admins.data?.items ?? [];

  return (
    <div className="gm-adm">
      <div className="gm-page-header">
        <div>
          <h1>Adminlar</h1>
          <p className="gm-page-lead">Yangi adminlar yarating, ularning huquqlari va akkauntlarini boshqaring.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus size={17} aria-hidden="true" /> Yangi admin yaratish
        </Button>
      </div>

      <Alert tone="info" title="Huquqlar">
        <strong>Superadmin</strong> — barcha amallar va adminlarni boshqarish. <strong>Admin</strong> — faqat siz tanlagan bo‘limlar (masalan, buyurtmalar yoki ustalarni tasdiqlash); boshqa adminlarni boshqara olmaydi.
      </Alert>

      {admins.isLoading && <PageLoader label="Adminlar yuklanmoqda…" />}
      {admins.isError && <Alert tone="danger">{getErrorMessage(admins.error)}</Alert>}
      {setSuper.isError && <Alert tone="danger">{getErrorMessage(setSuper.error)}</Alert>}
      {admins.data && items.length === 0 && <EmptyState title="Adminlar yo‘q" />}

      <div className="gm-adm__list">
        {items.map((admin) => {
          const status = STATUS[admin.status] ?? { label: admin.status, tone: 'neutral' as BadgeTone };
          const restricted = admin.status === 'SUSPENDED' || admin.status === 'BLOCKED';
          return (
            <article key={admin.id} className="gm-adm__card">
              <div className="gm-adm__who">
                <ChatAvatar name={nameOf(admin)} seed={admin.id} size="md" />
                <div className="gm-adm__info">
                  <h2>
                    <Link to={`/admin/foydalanuvchilar/${admin.accountNumber}`}>{nameOf(admin)}</Link>
                  </h2>
                  <p>
                    ID {admin.accountNumber} · {admin.phone}
                  </p>
                  <p className="gm-adm__meta">
                    Qo‘shilgan: {formatDateTime(admin.createdAt)}
                    {admin.lastLoginAt && ` · Oxirgi kirish: ${formatDateTime(admin.lastLoginAt)}`}
                  </p>
                </div>
                <div className="gm-adm__badges">
                  <Badge tone={admin.isSuperAdmin ? 'primary' : 'neutral'}>{admin.isSuperAdmin ? 'Superadmin' : 'Admin'}</Badge>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {admin.isSelf && <Badge tone="success">Siz</Badge>}
                </div>
              </div>

              <div className="gm-adm__perms">
                <span className="gm-adm__perms-title">Ruxsat berilgan bo‘limlar:</span>
                {admin.isSuperAdmin ? (
                  <Badge tone="primary">Barcha bo‘limlar</Badge>
                ) : (admin.adminPermissions ?? []).length > 0 ? (
                  (admin.adminPermissions ?? []).map((key) => (
                    <Badge key={key} tone="neutral">
                      {PERMISSION_LABEL[key] ?? key}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="warning">Hech qaysi</Badge>
                )}
              </div>

              {!admin.isSelf && (
                <div className="gm-adm__actions">
                  {!admin.isSuperAdmin && (
                    <Button size="sm" variant="secondary" onClick={() => setPermissionsFor(admin)}>
                      <ListChecks size={15} aria-hidden="true" /> Huquqlar
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setPasswordFor(admin)}>
                    <KeyRound size={15} aria-hidden="true" /> Yangi parol
                  </Button>
                  <Button size="sm" variant="secondary" loading={setSuper.isPending && setSuper.variables?.id === admin.id} onClick={() => setSuper.mutate({ id: admin.id, value: !admin.isSuperAdmin })}>
                    {admin.isSuperAdmin ? <ShieldOff size={15} aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
                    {admin.isSuperAdmin ? 'Oddiy admin qilish' : 'Superadmin qilish'}
                  </Button>
                  {restricted ? (
                    <Button size="sm" onClick={() => setDialog({ admin, action: 'ACTIVATE' })}>
                      <CheckCircle2 size={15} aria-hidden="true" /> Faollashtirish
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--warn" onClick={() => setDialog({ admin, action: 'SUSPEND' })}>
                        <Snowflake size={15} aria-hidden="true" /> Muzlatish
                      </Button>
                      <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--danger" onClick={() => setDialog({ admin, action: 'BLOCK' })}>
                        <Ban size={15} aria-hidden="true" /> Bloklash
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="gm-btn-danger-text" onClick={() => setDialog({ admin, action: 'DELETE' })}>
                    <Trash2 size={15} aria-hidden="true" /> O‘chirish
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {creating && <CreateAdminDialog onClose={() => setCreating(false)} />}
      {dialog && <UserActionDialog user={asUser(dialog.admin)} action={dialog.action} onClose={() => setDialog(null)} />}
      {permissionsFor && <AdminPermissionsDialog admin={permissionsFor} onClose={() => setPermissionsFor(null)} />}
      {passwordFor && <PasswordResetDialog userId={passwordFor.id} name={nameOf(passwordFor)} phone={passwordFor.phone} onClose={() => setPasswordFor(null)} />}
    </div>
  );
}
