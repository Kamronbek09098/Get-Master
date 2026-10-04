import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/styles/global.css';
import { applyUiSize, getUiSize } from '@/lib/ui-size';
import '@/styles/polish.css';
import '@/styles/compact.css';
import '@/styles/cards.css';
import '@/styles/premium.css';

import { env } from '@/lib/env';
import { t } from '@/i18n';

applyUiSize(getUiSize());

// Trekped/sichqoncha bilan chapga–o‘ngga surilganda brauzer «orqaga/oldinga» sahifaga o‘tib ketmasin:
// gorizontal g‘ildirak harakati, agar ostida gorizontal skroll qilinadigan element bo‘lmasa, to‘xtatiladi.
function horizontallyScrollable(start: EventTarget | null, dx: number): boolean {
  let el = start instanceof HTMLElement ? start : null;
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    const canScrollX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    if (canScrollX) {
      const atStart = el.scrollLeft <= 0 && dx < 0;
      const atEnd = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth && dx > 0;
      if (!atStart && !atEnd) return true;
    }
    el = el.parentElement;
  }
  return false;
}
window.addEventListener(
  'wheel',
  (event) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && !event.ctrlKey && !horizontallyScrollable(event.target, event.deltaX)) {
      event.preventDefault();
    }
  },
  { passive: false },
);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Ochilish (splash): chizma + foiz hisoblagich (000 → 100), so‘ng parda ochiladi. Seansda faqat bir marta.
const splash = document.getElementById('gm-splash');
if (splash) {
  const tag = splash.querySelector('.gm-sp__tag');
  const counter = document.getElementById('gm-sp-count');
  const cap = splash.querySelector('.gm-sp__cap');
  if (tag) tag.textContent = env.appRole === 'MASTER' ? t('Ustalar uchun') : env.appRole === 'ADMIN' ? t('Boshqaruv paneli') : t('Uy va xonadon xizmatlari');
  if (cap) {
    const line = env.appRole === 'MASTER' ? t('Mijozlar o‘zi topadi — siz ishlaysiz') : env.appRole === 'ADMIN' ? t('Platformani boshqarish paneli') : t('Muammoni ayting — mos ustani biz topamiz');
    cap.textContent = line;
  }
  const DURATION = 2300;
  const startedAt = performance.now();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / (reduce ? 1 : DURATION));
    const eased = 1 - Math.pow(1 - progress, 3);
    if (counter) counter.firstChild!.textContent = String(Math.round(eased * 100)).padStart(3, '0');
    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }
    try {
      sessionStorage.setItem('getmaster.splash', '1');
    } catch {
      /* sessionStorage mavjud emas */
    }
    window.setTimeout(() => {
      splash.classList.add('is-hiding');
      window.setTimeout(() => splash.remove(), 1000);
    }, 250);
  };
  requestAnimationFrame(tick);
}
