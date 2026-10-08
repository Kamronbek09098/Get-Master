import type { CSSProperties } from 'react';
import { t } from '@/i18n';
import { CATEGORIES } from '../landing-content';
import './ServiceBelt.css';

type WorkKind = 'santexnika' | 'elektr' | 'tamirlash' | 'mebel';

/** Platforma ustalari bajargan haqiqiy ishlar: `public/media/works/<tur>-<n>.jpg`. */
const KIND_NAME: Record<WorkKind, string> = { santexnika: 'Santexnika', elektr: 'Elektr', tamirlash: 'Ta’mirlash', mebel: 'Mebel' };
const WORK_ROWS: Array<{ dir: 'left' | 'right'; speed: number; works: string[] }> = [
  { dir: 'left', speed: 70, works: ['santexnika-1', 'elektr-1', 'tamirlash-1', 'mebel-1', 'santexnika-7', 'tamirlash-3', 'elektr-3'] },
  { dir: 'right', speed: 76, works: ['elektr-2', 'santexnika-3', 'mebel-2', 'tamirlash-2', 'santexnika-5', 'santexnika-8'] },
  { dir: 'left', speed: 66, works: ['mebel-3', 'santexnika-6', 'tamirlash-4', 'santexnika-2', 'santexnika-4'] },
];

const kindOf = (file: string) => file.split('-')[0] as WorkKind;
const iconOf = (kind: WorkKind) => CATEGORIES.find((item) => item.name === t(KIND_NAME[kind]) || item.name === KIND_NAME[kind])?.icon;

/**
 * «Biz orqali qilingan ishlar»: uch qator rasmli kartochka. Yuqori va pastki qator chapga, o‘rtadagi qator yarim kartochkaga surilgan holda o‘ngga suzadi;
 * chetlari yumshoq so‘nadi. Kartochkalar bosilmaydi.
 */
export function ServiceBelt() {
  return (
    <section className="gm-works" aria-labelledby="gm-works-title">
      <header className="gm-works__head">
        <span className="gm-works__kicker">{t('Portfolio')}</span>
        <h2 id="gm-works-title">{t('Biz orqali qilingan ishlar')}</h2>
        <p>{t('Platformadagi ustalar bajargan haqiqiy loyihalardan namunalar.')}</p>
      </header>
      <div className="gm-belt">
        {WORK_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className={`gm-belt-row gm-belt-row--${row.dir}`} style={{ ['--dur' as string]: `${row.speed}s` } as CSSProperties}>
            <div className="gm-belt-track">
              {[0, 1, 2, 3].map((copy) => (
                <ul key={copy} className="gm-belt-list" aria-hidden={copy > 0 || undefined}>
                  {row.works.map((file) => {
                    const kind = kindOf(file);
                    const Icon = iconOf(kind);
                    return (
                      <li key={`${copy}-${file}`}>
                        <img src={`/media/works/${file}.jpg`} alt={copy === 0 ? t('{name}: bajarilgan ish', { name: t(KIND_NAME[kind]) }) : ''} width={760} height={480} loading="lazy" decoding="async" draggable={false} />
                        <span className="gm-belt-tag">
                          {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
                          {t(KIND_NAME[kind])}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
