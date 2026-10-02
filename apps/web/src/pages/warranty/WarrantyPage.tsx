import { ClipboardCheck, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useAuthStore } from '@/store/auth.store';
import { useMyWarranties } from '@/features/warranty/hooks/useWarranties';
import { WarrantyCard } from '@/features/warranty/components/WarrantyCard';

export function WarrantyPage() {
  const warranties = useMyWarranties();
  const role = useAuthStore((state) => state.preferredRole);
  const items = warranties.data ?? [];
  const isMaster = role === 'MASTER';

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Kafolatlar</h1>
          <p className="gm-page-lead">Bajarilgan ishlar bo‘yicha kafolat murojaatlari.</p>
        </div>
      </div>
      {warranties.isLoading && <PageLoader label="Kafolatlar yuklanmoqda…" />}
      {warranties.isError && <Alert tone="danger">{getErrorMessage(warranties.error)}</Alert>}
      {!warranties.isLoading && items.length === 0 && (
          <EmptyState
            icon={<ShieldCheck size={34} strokeWidth={1.8} />}
            title="Hali kafolatlar yo‘q"
            description={isMaster ? 'Yakunlangan ishlaringiz bo‘yicha kafolat murojaatlari shu yerda ko‘rinadi.' : 'Ish yakunlangach, unga kafolat beriladi. Muammo qaytsa, shu yerdan murojaat qilasiz.'}
            steps={[
              { icon: <ClipboardCheck size={16} aria-hidden="true" />, title: 'Ish yakunlanadi', text: isMaster ? 'Ishni tugatasiz, mijoz natijani tasdiqlaydi.' : 'Usta ishni tugatadi, siz natijani tasdiqlaysiz.' },
              { icon: <ShieldCheck size={16} aria-hidden="true" />, title: 'Kafolat boshlanadi', text: 'Bajarilgan ish uchun kafolat muddati shu yerda ko‘rinadi.' },
              { icon: <MessageSquareWarning size={16} aria-hidden="true" />, title: 'Murojaat qiling', text: isMaster ? 'Mijoz nuqson haqida murojaat yuborsa, shu yerda ko‘rasiz.' : 'Nuqson chiqsa, kafolat doirasida murojaat yuboring.' },
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
