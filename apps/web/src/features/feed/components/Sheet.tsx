import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { t } from '@/i18n';

/** Telefonda — pastdan chiqadigan oyna (sudrab yopiladi), kompyuterda — o‘ng tomondagi panel. */
export function Sheet({ open, title, subtitle, onClose, children, tall = false, label }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode; tall?: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useSheetDrag(ref, onClose);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="gf-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={ref} className={tall ? 'gf-sheet gf-sheet--tall' : 'gf-sheet'} role="dialog" aria-modal="true" aria-label={label ?? title} tabIndex={-1}>
        <div className="gf-sheet__grab" aria-hidden="true" {...drag} />
        <header className="gf-sheet__head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="gf-iconbtn" onClick={onClose} aria-label={t('Yopish')}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="gf-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
