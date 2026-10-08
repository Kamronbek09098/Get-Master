import { Link } from 'react-router-dom';
import { ChevronRight, Heart } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import { useFavorites, useToggleFavorite } from '../hooks/useFavorites';
import './CustomerActivity.css';

/** Saqlangan ustalar. */
export function SavedMastersCard() {
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const list = favorites.data ?? [];
  return (
    <ProfileCard icon={Heart} title={t('Saqlangan ustalar')} hint={t('Yoqqan ustalaringizni tez topish uchun')}>
      {favorites.isError && <Alert tone="danger">{getErrorMessage(favorites.error)}</Alert>}
      {!favorites.isError && list.length === 0 && <p className="gm-pempty">{t('Hali usta saqlanmagan. Usta profilidagi «Saqlash» tugmasini bosing.')}</p>}
      {list.length > 0 && (
        <ul className="gm-act">
          {list.map((master) => (
            <li key={master.id} className="gm-act__row">
              <Link to={`/mijoz/ustalar/${master.user.accountNumber ?? master.id}`} className="gm-act__item">
                <span className="gm-act__top">
                  <strong>{accountName(master.user)}</strong>
                  <ChevronRight size={16} aria-hidden="true" />
                </span>
                <span className="gm-act__sub">
                  {master.profession ?? t('Usta')} · ★ {Number(master.ratingAvg).toFixed(1)}
                </span>
              </Link>
              <button
                type="button"
                className="gm-act__remove"
                aria-label={t('{name} — saqlanganlardan olib tashlash', { name: accountName(master.user) })}
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ masterId: master.id, saved: true })}
              >
                <Heart size={18} fill="currentColor" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ProfileCard>
  );
}
