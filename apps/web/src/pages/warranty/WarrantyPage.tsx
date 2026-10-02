import { ClipboardCheck, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useAuthStore } from '@/store/auth.store';
import { useMyWarranties } from '@/features/warranty/hooks/useWarranties';
import { WarrantyCard } from '@/features/warranty/components/WarrantyCard';
import { t } from '@/i18n';

export function WarrantyPage() {
  const warranties = useMyWarranties();
  const role = useAuthStore((state) => state.preferredRole);
  const items = warranties.data ?? [];
  const isMaster = role === 'MASTER';

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Kafolatlar')}</h1>
          <p className="gm-page-lead">{t('Bajarilgan ishlar bo‘yicha kafolat murojaatlari.')}</p>
        </div>
      </div>
      {warranties.isLoading && <PageLoader label={t('Kafolatlar yuklanmoqda…')} />}
      {warranties.isError && <Alert tone="danger">{getErrorMessage(warranties.error)}</Alert>}
      {!warranties.isLoading && items.length === 0 && (
          <EmptyState
            icon={<ShieldCheck size={34} strokeWidth={1.8} />}
            title={t('Hali kafolatlar yo‘q')}
            description={isMaster ? t('Yakunlangan ishlaringiz bo‘yicha kafolat murojaatlari shu yerda ko‘rinadi.') : t('Ish yakunlangach, unga kafolat beriladi. Muammo qaytsa, shu yerdan murojaat qilasiz.')}
            steps={[
              { icon: <ClipboardCheck size={16} aria-hidden="true" />, title: t('Ish yakunlanadi'), text: isMaster ? t('Ishni tugatasiz, mijoz natijani tasdiqlaydi.') : t('Usta ishni tugatadi, siz natijani tasdiqlaysiz.') },
              { icon: <ShieldCheck size={16} aria-hidden="true" />, title: t('Kafolat boshlanadi'), text: t('Bajarilgan ish uchun kafolat muddati shu yerda ko‘rinadi.') },
              { icon: <MessageSquareWarning size={16} aria-hidden="true" />, title: t('Murojaat qiling'), text: isMaster ? t('Mijoz nuqson haqida murojaat yuborsa, shu yerda ko‘rasiz.') : t('Nuqson chiqsa, kafolat doirasida murojaat yuboring.') },
            ]}
          />
        )}
      <div className="gm-list">
        {items.map((warranty) => (
          <WarrantyCard key={warranty.id} warranty={warranty} canClaim={role !== 'MASTER'} />
        ))}
      </div>
    </div>
  );
}
