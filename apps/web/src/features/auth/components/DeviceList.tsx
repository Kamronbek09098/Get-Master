import { useState } from 'react';
import { Globe, LogOut, Monitor, Smartphone, Tablet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { PANEL_LABEL } from '@/lib/panel';
import { describeDevice } from '@/lib/user-agent';
import type { DeviceKind } from '@/lib/user-agent';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import type { Role } from '@/types/common';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '../hooks/useAuth';

const ICONS: Record<DeviceKind, LucideIcon> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet, unknown: Globe };

export function DeviceList() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (sessions.isLoading) return <PageLoader label="Qurilmalar yuklanmoqda…" />;
  if (sessions.isError) return <Alert tone="danger">{getErrorMessage(sessions.error)}</Alert>;

  const items = sessions.data ?? [];
  const others = items.filter((item) => !item.isCurrent);
  const blocked = items.some((session) => !session.isCurrent && !session.canRevoke);
  const error = revoke.error ?? revokeOthers.error;

  return (
    <div className="gm-devices">
      <div className="gm-devices__head">
        <p className="gm-card__meta">
          Akkauntingizga ulangan faol qurilmalar: <strong>{items.length}</strong> ta. Tanimagan qurilma ko‘rsangiz, uni
          darhol chiqaring va parolni almashtiring.
        </p>
        {others.length > 0 && (
          <Button size="sm" variant="secondary" disabled={blocked} onClick={() => setConfirmOthers(true)}>
            <LogOut size={16} /> Boshqa qurilmalardan chiqish
          </Button>
        )}
      </div>

      {blocked && (
        <Alert tone="warning">
          Bu qurilma yaqinda ulangan. Xavfsizlik uchun u o‘zidan oldin ulangan qurilmalarni ko‘rsatilgan vaqtgacha chiqara olmaydi.
        </Alert>
      )}
      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      {revokeOthers.isSuccess && (
        <Alert tone="success">Boshqa qurilmalardan chiqildi ({revokeOthers.data.revoked} ta).</Alert>
      )}
      {items.length === 0 && <EmptyState title="Faol qurilma topilmadi" />}

      <ul className="gm-devices__list">
        {items.map((session) => {
          const device = describeDevice(session.userAgent);
          const Icon = ICONS[device.kind];
          const panel = session.panel ? PANEL_LABEL[session.panel as Role] : null;
          return (
            <li key={session.id} className={`gm-device${session.isCurrent ? ' gm-device--current' : ''}`}>
              <span className="gm-device__icon" aria-hidden="true">
                <Icon size={24} strokeWidth={1.9} />
              </span>
              <div className="gm-device__body">
                <div className="gm-device__title">
                  <strong>{session.userAgent ? `${device.browser} · ${device.os}` : 'Noma’lum qurilma'}</strong>
                  {session.isCurrent && <Badge tone="success">Joriy qurilma</Badge>}
                  {panel && <Badge tone="primary">{panel}</Badge>}
                </div>
                <p className="gm-card__meta">
                  {session.ipAddress ? `IP: ${session.ipAddress} · ` : ''}
                  {session.isCurrent ? 'Hozir faol' : `Oxirgi faollik: ${formatRelativeTime(session.lastSeenAt)}`}
                </p>
                <p className="gm-card__meta">Kirilgan: {formatDateTime(session.createdAt)}</p>
              </div>
              {!session.isCurrent && !session.canRevoke && (
                <span className="gm-device__locked" title="Yangi qurilma o‘zidan oldin ulangan qurilmalarni 24 soat chiqara olmaydi">
                  {formatDateTime(session.revokeLockedUntil)} dan keyin
                </span>
              )}
              {!session.isCurrent && session.canRevoke && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={revoke.isPending && busyId === session.id}
                  onClick={() => {
                    setBusyId(session.id);
                    revoke.mutate(session.id);
                  }}
                >
                  Chiqarish
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirmOthers}
        title="Boshqa qurilmalardan chiqish"
        description={`Joriy qurilmadan tashqari ${others.length} ta qurilma tizimdan chiqariladi. Ular qayta kirishi kerak bo‘ladi.`}
        confirmLabel="Chiqarish"
        tone="danger"
        loading={revokeOthers.isPending}
        onCancel={() => setConfirmOthers(false)}
        onConfirm={() => revokeOthers.mutate(undefined, { onSettled: () => setConfirmOthers(false) })}
      />
    </div>
  );
}
