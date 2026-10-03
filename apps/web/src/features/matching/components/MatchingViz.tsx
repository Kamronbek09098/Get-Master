import { Check, Clock3, MapPin, Search, Sparkles, Star, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './MatchingViz.css';
import { t } from '@/i18n';

const STAGES: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Sparkles, label: t('Muammo tushunilmoqda') },
  { icon: MapPin, label: t('Joylashuv tekshirilmoqda') },
  { icon: Wrench, label: t('Ko‘nikmalar solishtirilmoqda') },
  { icon: Clock3, label: t('Bo‘sh vaqt aniqlanmoqda') },
  { icon: Star, label: t('Reyting hisobga olinmoqda') },
];

/**
 * Moslash jarayonining jonli ko‘rinishi (spinner o‘rniga): so‘rov markazda, mezonlar birin-ketin yonadi.
 * `done` bo‘lsa — yakuniy «moslik» holati; `found` — topilgan ustalar soni (haqiqiy ma’lumot).
 */
export function MatchingViz({ done = false, found = 0 }: { done?: boolean; found?: number }) {
  return (
    <section className={done ? 'gm-mviz gm-mviz--done' : 'gm-mviz'} role="status" aria-live="polite" aria-label={done ? t('Qidiruv yakunlandi') : t('Ustalar izlanmoqda')}>
      <div className="gm-mviz__stage" aria-hidden="true">
        <span className="gm-mviz__ring gm-mviz__ring--a" />
        <span className="gm-mviz__ring gm-mviz__ring--b" />
        <span className="gm-mviz__core">{done ? <Check size={26} strokeWidth={3} /> : <Search size={24} />}</span>
        {STAGES.map((stage, i) => (
          <span key={stage.label} className="gm-mviz__dot" style={{ ['--i' as string]: i, ['--n' as string]: STAGES.length }}>
            <stage.icon size={14} />
          </span>
        ))}
      </div>
      <div className="gm-mviz__text">
        <strong>{done ? (found > 0 ? t('{found} ta mos usta topildi', { found }) : t('Hozircha mos usta topilmadi')) : t('GetMaster mos ustani izlayapti')}</strong>
        {done ? (
          <p>{found > 0 ? t('Quyida eng mos ustalar tartib bilan ko‘rsatilgan.') : t('Ustalar o‘zlari ham taklif yuborishi mumkin — yangilari «Takliflar» bo‘limida paydo bo‘ladi.')}</p>
        ) : (
          <ol className="gm-mviz__steps">
            {STAGES.map((stage, i) => (
              <li key={stage.label} style={{ ['--i' as string]: i }}>
                <stage.icon size={13} aria-hidden="true" /> {stage.label}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
