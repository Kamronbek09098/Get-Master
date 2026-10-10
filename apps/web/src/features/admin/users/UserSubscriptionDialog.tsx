import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useAdminSubscriptionActions } from '@/features/subscription/hooks';
import type { PlanCode } from '@/features/subscription/types';
import { accountName } from '@/lib/account-name';
import type { AdminUser, AdminUserDetail } from '../types';
import { t } from '@/i18n';

type Target = Pick<AdminUser, 'id' | 'accountNumber' | 'firstName' | 'lastName' | 'roles'>;

/** Tanlangan foydalanuvchiga obuna berish yoki mavjudini uzaytirish (yangi obuna joriysi tugagandan keyin boshlanadi). */
export function UserSubscriptionDialog({ user, onClose }: { user: Target | AdminUserDetail; onClose: () => void }) {
  const { grant } = useAdminSubscriptionActions();
  const queryClient = useQueryClient();
  const plans: Array<{ value: PlanCode; label: string }> = [
    ...(user.roles.includes('CUSTOMER') ? [{ value: 'CUSTOMER_PLUS' as const, label: t('Mijoz · Plus') }] : []),
    ...(user.roles.includes('MASTER') ? [{ value: 'MASTER_PRO' as const, label: t('Usta · Pro') }] : []),
  ];
  const [planCode, setPlanCode] = useState<PlanCode>(plans[0]?.value ?? 'CUSTOMER_PLUS');
  const [months, setMonths] = useState('1');
  const [note, setNote] = useState('');

  return (
    <Modal
      open
      onClose={grant.isPending ? () => undefined : onClose}
      title={t('Obuna berish yoki uzaytirish')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={grant.isPending}>{t('Bekor qilish')}</Button>
          <Button
            loading={grant.isPending}
            disabled={plans.length === 0}
            onClick={() =>
              grant.mutate(
                { user: user.id, planCode, months: Number(months), note: note.trim() || undefined },
                {
                  onSuccess: () => {
                    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
                    void queryClient.invalidateQueries({ queryKey: ['admin', 'user-number'] });
                    onClose();
                  },
                },
              )
            }
          >
            <Gift size={16} aria-hidden="true" /> {t('Tasdiqlash')}
          </Button>
        </>
      }
    >
      <div className="gm-form">
        <p>
          <strong>{accountName(user)}</strong> · ID {user.accountNumber}
        </p>
        {grant.isError && <Alert tone="danger">{getErrorMessage(grant.error)}</Alert>}
        <Alert tone="info">{t('Obuna bepul beriladi. Agar foydalanuvchida faol obuna bo‘lsa, yangi muddat joriy obuna tugagandan keyin boshlanadi.')}</Alert>
        <Select label={t('Reja')} value={planCode} onChange={(event) => setPlanCode(event.target.value as PlanCode)} options={plans} />
        <Select label={t('Muddat')} value={months} onChange={(event) => setMonths(event.target.value)} options={[1, 2, 3, 6, 12].map((value) => ({ value: String(value), label: value === 12 ? t('1 yil') : t('{months} oy', { months: value }) }))} />
        <Textarea label={t('Izoh (ixtiyoriy)')} rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
    </Modal>
  );
}
