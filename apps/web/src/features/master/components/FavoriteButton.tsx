import { Heart } from 'lucide-react';
import { useFavorites, useToggleFavorite } from '@/features/customer/hooks/useFavorites';
import { t } from '@/i18n';
import './FavoriteButton.css';

/** Ustani saqlash / saqlanganlardan olib tashlash (faqat mijoz). */
export function FavoriteButton({ masterId }: { masterId: string }) {
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const saved = (favorites.data ?? []).some((master) => master.id === masterId);
  return (
    <button
      type="button"
      className={saved ? 'gm-fav is-saved' : 'gm-fav'}
      aria-pressed={saved}
      disabled={favorites.isLoading || toggle.isPending}
      onClick={() => toggle.mutate({ masterId, saved })}
    >
      <Heart size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      {saved ? t('Saqlangan') : t('Saqlash')}
    </button>
  );
}
