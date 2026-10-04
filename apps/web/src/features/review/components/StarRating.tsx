import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import './StarRating.css';

/** Ball (0.5 qadam bilan) → so‘zli baho. */
function ratingWord(value: number): string {
  if (value <= 1) return t('Juda yomon');
  if (value <= 2) return t('Yomon');
  if (value <= 3) return t('O‘rtacha');
  if (value <= 4) return t('Yaxshi');
  return t('A’lo');
}

const STAR_PATH = 'M12 2.6l2.9 6.1 6.7.9-4.9 4.6 1.2 6.6L12 17.6 6.1 20.8l1.2-6.6L2.4 9.6l6.7-.9z';

function StarSvg({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cx('gm-stars__svg', on && 'is-on')}>
      <path d={STAR_PATH} strokeLinejoin="round" />
    </svg>
  );
}

/** Bitta yulduz: bo‘sh, yarim yoki to‘la (to‘ldirilgan qatlam kenglik bo‘yicha kesiladi). */
function Star({ fill }: { fill: 0 | 0.5 | 1 }) {
  return (
    <span className="gm-stars__star" aria-hidden="true">
      <StarSvg on={false} />
      <span className="gm-stars__fill" style={{ width: `${fill * 100}%` }}>
        <StarSvg on />
      </span>
    </span>
  );
}

const fillOf = (n: number, value: number): 0 | 0.5 | 1 => (value >= n ? 1 : value >= n - 0.5 ? 0.5 : 0);
const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * Yulduzli baho (yarim yulduz bilan): kursor yulduzlar bo‘ylab yurgizilganda baho joyiga qarab (0.5 qadam bilan) ko‘rinadi,
 * bosilganda tanlanadi; bosib turib sudralganda tanlov kursor bilan birga o‘zgaradi (sensorli ekranda ham).
 * Klaviatura: ← → (0.5 qadam), Home/End, 1–5. Skrinrider uchun slayder sifatida ochiladi.
 */
export function StarRating({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  const groupId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const shown = hover || value;

  /** Kursor holati → baho: birinchi yulduz chetidan oxirgisigacha, har yulduz = 1 ball, qadam 0.5. */
  const valueAt = (clientX: number): number => {
    const stars = rowRef.current?.querySelectorAll<HTMLElement>('.gm-stars__btn');
    if (!stars || stars.length < 5) return 0;
    const first = stars[0]!.getBoundingClientRect();
    const last = stars[4]!.getBoundingClientRect();
    const raw = ((clientX - first.left) / (last.right - first.left)) * 5;
    return Math.min(5, Math.max(0.5, Math.ceil(raw * 2) / 2));
  };

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ba’zi qurilmalarda mavjud emas — sudrash baribir ishlaydi */
    }
    onChange(valueAt(event.clientX));
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const next = valueAt(event.clientX);
    if (dragging.current) onChange(next);
    else if (event.pointerType === 'mouse') setHover(next);
  }
  function endDrag() {
    dragging.current = false;
  }

  function onKeyDown(event: KeyboardEvent) {
    let next = value;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, (value || 0) + 0.5);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0.5, (value || 1) - 0.5);
    else if (event.key === 'Home') next = 0.5;
    else if (event.key === 'End') next = 5;
    else if (/^[1-5]$/.test(event.key)) next = Number(event.key);
    else return;
    event.preventDefault();
    onChange(next);
  }

  return (
    <div className="gm-stars">
      <span id={groupId} className="gm-stars__legend">
        {label}
      </span>
      <div
        ref={rowRef}
        className="gm-stars__row"
        role="slider"
        tabIndex={0}
        aria-labelledby={groupId}
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={value || undefined}
        aria-valuetext={value ? `${format(value)} — ${ratingWord(value)}` : t('Baho tanlanmagan')}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !dragging.current && setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={cx('gm-stars__btn', Math.ceil(value) === n && 'is-picked')}>
            <Star fill={fillOf(n, shown)} />
          </span>
        ))}
      </div>
      <span className={cx('gm-stars__caption', shown > 0 && 'is-set')} aria-live="polite">
        {shown > 0 ? `${format(shown)} — ${ratingWord(shown)}` : t('Yulduzchani bosing (yarim yulduz ham mumkin)')}
      </span>
    </div>
  );
}

/** Faqat ko‘rsatish uchun yulduzlar (yarim yulduz bilan). */
export function StarsStatic({ value }: { value: number }) {
  return (
    <span className="gm-stars-static" role="img" aria-label={`${format(value)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} fill={fillOf(n, value)} />
      ))}
    </span>
  );
}
