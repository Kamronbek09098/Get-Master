import { useCallback, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { t } from '@/i18n';

/** Oldin | Keyin: sudrab (sensor, sichqoncha) yoki ← → tugmalari bilan taqqoslanadi. */
export function BeforeAfter({ before, after, alt, onDragState }: { before: string; after: string; alt: string; onDragState?: (dragging: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  const setPos = useCallback((value: number) => {
    const v = Math.min(100, Math.max(0, value));
    box.current?.style.setProperty('--pos', `${v.toFixed(1)}%`);
    if (range.current) range.current.value = String(Math.round(v));
  }, []);

  const move = (event: ReactPointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect) setPos(((event.clientX - rect.left) / rect.width) * 100);
  };

  return (
    <div
      ref={box}
      className="gf-ba"
      style={{ '--pos': '50%' } as CSSProperties}
      onPointerDown={(event) => {
        dragging.current = true;
        onDragState?.(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => dragging.current && move(event)}
      onPointerUp={() => {
        dragging.current = false;
        onDragState?.(false);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onDragState?.(false);
      }}
    >
      <img className="gf-ba__img" src={after} alt={`${alt} — ${t('Keyin')}`} draggable={false} />
      <img className="gf-ba__img gf-ba__img--before" src={before} alt={`${alt} — ${t('Oldin')}`} draggable={false} />
      <span className="gf-ba__tag gf-ba__tag--before">{t('Oldin')}</span>
      <span className="gf-ba__tag gf-ba__tag--after">{t('Keyin')}</span>
      <span className="gf-ba__line" aria-hidden="true">
        <i>
          <b />
          <b />
        </i>
      </span>
      <input ref={range} className="gf-ba__range" type="range" min={0} max={100} defaultValue={50} aria-label={t('Oldin va keyin taqqoslash')} onChange={(event) => setPos(Number(event.currentTarget.value))} />
    </div>
  );
}
