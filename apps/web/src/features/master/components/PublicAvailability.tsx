import { t } from '@/i18n';
import { useMasterAvailability } from '../hooks/useMaster';
import './PublicAvailability.css';

const DAYS = [t('Yakshanba'), t('Dushanba'), t('Seshanba'), t('Chorshanba'), t('Payshanba'), t('Juma'), t('Shanba')];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Haftalik ish jadvali: ochiq oynalar kun bo‘yicha; oynasi yo‘q kun — «Band». */
export function PublicAvailability({ masterId }: { masterId: string }) {
  const availability = useMasterAvailability(masterId);
  const windows = availability.data ?? [];
  if (availability.isLoading || availability.isError || windows.length === 0) return null;
  const today = new Date().getDay();

  return (
    <section className="gm-mp-section">
      <h2>{t('Ish vaqti')}</h2>
      <ul className="gm-pub-av">
        {ORDER.map((day) => {
          const slots = windows.filter((window) => window.dayOfWeek === day);
          return (
            <li key={day} className={day === today ? 'is-today' : undefined}>
              <span>{DAYS[day]}</span>
              <strong className={slots.length === 0 ? 'is-off' : undefined}>
                {slots.length === 0 ? t('Band') : slots.map((slot) => `${slot.startTime} – ${slot.endTime}`).join(', ')}
              </strong>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
