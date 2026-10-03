import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/styles/global.css';
import { applyUiSize, getUiSize } from '@/lib/ui-size';
import '@/styles/polish.css';
import '@/styles/compact.css';
import '@/styles/cards.css';

import { env } from '@/lib/env';
import { t } from '@/i18n';

applyUiSize(getUiSize());

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Ochilish (splash) animatsiyasi: kamida ~1.6 soniya ko‘rinadi, so‘ng yumshoq yo‘qoladi. Seansda faqat bir marta.
const splash = document.getElementById('gm-splash');
if (splash) {
  const tag = splash.querySelector('.gm-sp__tag');
  if (tag) {
    tag.textContent =
      env.appRole === 'MASTER' ? t('Mijozlar o‘zi topadi — siz ishlaysiz') : env.appRole === 'ADMIN' ? t('Platformani boshqarish paneli') : t('Muammoni ayting — mos ustani biz topamiz');
  }
  const MIN_VISIBLE_MS = 1600;
  const remaining = Math.max(0, MIN_VISIBLE_MS - performance.now());
  window.setTimeout(() => {
    try {
      sessionStorage.setItem('getmaster.splash', '1');
    } catch {
      /* sessionStorage mavjud emas */
    }
    splash.classList.add('is-hiding');
    window.setTimeout(() => splash.remove(), 600);
  }, remaining);
}
