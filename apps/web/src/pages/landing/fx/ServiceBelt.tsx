import type { CSSProperties } from 'react';
import { t } from '@/i18n';
import { CATEGORIES } from '../landing-content';
import { ServiceArt, hasServiceArt, serviceTint } from './ServiceArt';
import './ServiceBelt.css';

/**
 * Xizmatlar «lentasi»: uch qator oq kartochka. Yuqori va pastki qator bir xil tezlikda chapga (kartochkalar bir-birining tagida), o‘rtadagi qator yarim kartochkaga surilgan holda o‘ngga suzadi;
 * chetlari yumshoq so‘nadi. Kartochkalar bosilmaydi va sichqoncha ustiga kelganda o‘zgarmaydi.
 */
const BELT_ROWS: Array<{ dir: 'left' | 'right'; offset: number; speed: number }> = [
  { dir: 'left', offset: 0, speed: 56 },
  { dir: 'right', offset: 3, speed: 62 },
  { dir: 'left', offset: 5, speed: 56 },
];

export function ServiceBelt() {
  return (
    <section className="gm-belt" aria-label={t('Xizmatlar')}>
      {BELT_ROWS.map((row, rowIndex) => {
        const items = [...CATEGORIES.slice(row.offset), ...CATEGORIES.slice(0, row.offset)];
        return (
          <div key={rowIndex} className={`gm-belt-row gm-belt-row--${row.dir}`} style={{ ['--dur' as string]: `${row.speed}s` } as CSSProperties}>
            <div className="gm-belt-track">
              {[0, 1, 2, 3].map((copy) => (
                <ul key={copy} className="gm-belt-list" aria-hidden={copy > 0 || undefined}>
                  {items.map((item) => (
                    <li key={`${copy}-${item.name}`}>
                      <span className="gm-belt-icon" style={{ ['--tint' as string]: serviceTint(item.name) } as CSSProperties}>
                        {hasServiceArt(item.name) ? <ServiceArt name={item.name} size={44} /> : <item.icon size={26} strokeWidth={1.8} />}
                      </span>
                      <strong>{item.name}</strong>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
