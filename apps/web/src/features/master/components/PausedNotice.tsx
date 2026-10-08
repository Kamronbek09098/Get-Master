import { Link } from 'react-router-dom';
import { Pause } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { useQuery } from '@tanstack/react-query';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import { masterService } from '../services/master.service';
import { t } from '@/i18n';

/** Usta pauza rejimida ekanini ko‘rsatadi: bu holatda taklif berib va buyurtma qabul qilib bo‘lmaydi. */
export function usePaused(): boolean {
  const preferred = useAuthStore((state) => state.preferredRole);
  const isMaster = (env.appRole ?? preferred) === 'MASTER';
  // Faqat usta panelida so‘raladi (mijozda profil yo‘q); kalit usta profili bilan umumiy.
  const profile = useQuery({ queryKey: ['master', 'me'], queryFn: () => masterService.getMine(), retry: false, enabled: isMaster });
  return isMaster && !!profile.data?.isPaused;
}

export function PausedNotice() {
  return (
    <div style={{ marginBottom: 16 }}>
    <Alert tone="warning" title={t('Siz pauza rejimidasiz')}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Pause size={14} aria-hidden="true" />
        {t('Pauza paytida taklif bera olmaysiz va yangi buyurtmalarni qabul qila olmaysiz.')}{' '}
        <Link to="/usta/profil/holat">{t('Pauzani o‘chirish')}</Link>
      </span>
    </Alert>
    </div>
  );
}
