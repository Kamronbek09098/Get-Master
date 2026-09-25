import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/utils';
import './Dropdown.css';

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: ReactNode;
}

export function Dropdown({ trigger, items }: { trigger: ReactNode; items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function focusItem(delta: number) {
    const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + delta + menuItems.length) % menuItems.length;
    menuItems[nextIndex]?.focus();
  }

  return (
    <div className="gm-dropdown" ref={rootRef}>
      <button
        type="button"
        className="gm-dropdown__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div className="gm-dropdown__menu" role="menu" ref={menuRef}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cx('gm-dropdown__item', item.danger && 'gm-dropdown__item--danger')}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  focusItem(1);
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  focusItem(-1);
                }
              }}
            >
              {item.icon && <span aria-hidden="true" className="gm-dropdown__icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
