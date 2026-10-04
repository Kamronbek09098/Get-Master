import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import './StarRating.css';

const RATING_LABELS: Record<number, string> = {
  1: t('Juda yomon'),
  2: t('Yomon'),
  3: t('O‘rtacha'),
  4: t('Yaxshi'),
  5: t('A’lo'),
};

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cx('gm-stars__svg', filled && 'is-on')}>
      <path d="M12 2.6l2.9 6.1 6.7.9-4.9 4.6 1.2 6.6L12 17.6 6.1 20.8l1.2-6.6L2.4 9.6l6.7-.9z" strokeLinejoin="round" />
    </svg>
  );
}

/** Yulduzli baho: sichqoncha ustiga borganda ko‘rsatiladi, bosilganda tanlanadi; klaviatura (← → ↑ ↓, 1–5) bilan ham ishlaydi. */
export function StarRating({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  const groupId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const shown = hover || value;

  function onKeyDown(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(4, index + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, index - 1);
    else if (/^[1-5]$/.test(event.key)) next = Number(event.key) - 1;
    else return;
    event.preventDefault();
    onChange(next + 1);
    refs.current[next]?.focus();
  }

  return (
    <div className="gm-stars">
      <span id={groupId} className="gm-stars__legend">
        {label}
      </span>
      <div className="gm-stars__row" role="radiogroup" aria-labelledby={groupId} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            ref={(node) => {
              refs.current[n - 1] = node;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} — ${RATING_LABELS[n]}`}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            className={cx('gm-stars__btn', n <= shown && 'is-on', value === n && 'is-picked')}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(0)}
            onClick={() => onChange(n)}
            onKeyDown={(event) => onKeyDown(event, n - 1)}
          >
            <Star filled={n <= shown} />
          </button>
        ))}
      </div>
      <span className={cx('gm-stars__caption', shown > 0 && 'is-set')} aria-live="polite">
        {shown > 0 ? `${shown} — ${RATING_LABELS[shown]}` : t('Yulduzchani bosing')}
      </span>
    </div>
  );
}

/** Faqat ko‘rsatish uchun yulduzlar (qoldirilgan sharh). */
export function StarsStatic({ value }: { value: number }) {
  return (
    <span className="gm-stars-static" role="img" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= value} />
      ))}
    </span>
  );
}
