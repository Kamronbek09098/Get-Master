import { useEffect } from 'react';

/** Surish yo‘nalishi → tarix harakati. Chapga surish — oldingi oyna, o‘ngga surish — keyingi oyna. */
const LEFT_GOES_BACK = true;

const MIN_DISTANCE = 90;
const MAX_DURATION_MS = 800;
const WHEEL_THRESHOLD = 160;
const WHEEL_COOLDOWN_MS = 700;

/** Surish boshqa vazifa bajaradigan elementlar: matn kiritish, xarita, xabar (javob berish), gorizontal aylanadigan bloklar. */
function isBlocked(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    if (node.matches('input, textarea, select, [contenteditable="true"], .leaflet-container, .gm-msg, [data-no-swipe], dialog, [role="dialog"]')) return true;
    const style = getComputedStyle(node);
    if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1) return true;
    node = node.parentElement;
  }
  return false;
}

type Direction = 'left' | 'right';

/** Orqaga — chap chetda ←, oldinga — o‘ng chetda → (Chrome'dagidek) doira ko‘rsatkich. */
function createIndicator() {
  const el = document.createElement('div');
  el.className = 'gm-swipe-nav';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="gm-swipe-nav__core"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></span>';
  document.body.appendChild(el);
  return {
    show(side: 'back' | 'forward', progress: number) {
      el.dataset.side = side;
      el.style.setProperty('--p', String(Math.min(Math.max(progress, 0), 1)));
      el.classList.add('is-visible');
      el.classList.toggle('is-ready', progress >= 1);
    },
    commit() {
      el.classList.add('is-commit');
      window.setTimeout(() => this.hide(), 260);
    },
    hide() {
      el.classList.remove('is-visible', 'is-ready', 'is-commit');
      el.style.setProperty('--p', '0');
    },
    destroy() {
      el.remove();
    },
  };
}

const sideOf = (direction: Direction): 'back' | 'forward' => ((direction === 'left') === LEFT_GOES_BACK ? 'back' : 'forward');

function go(direction: Direction) {
  if (sideOf(direction) === 'back') window.history.back();
  else window.history.forward();
}

/** Butun sayt bo‘ylab: barmoq/trekped bilan gorizontal surish orqali oldingi/keyingi oynaga o‘tish. */
export function useSwipeHistory() {
  useEffect(() => {
    const indicator = createIndicator();
    let start: { x: number; y: number; at: number } | null = null;
    let wheelSum = 0;
    let wheelAt = 0;
    let lastNav = 0;
    let wheelTimer: number | undefined;

    const horizontal = (dx: number, dy: number) => Math.abs(dy) <= Math.abs(dx) * 0.6;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 && touch && !isBlocked(event.target) ? { x: touch.clientX, y: touch.clientY, at: Date.now() } : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 12 || !horizontal(dx, dy)) {
        indicator.hide();
        return;
      }
      indicator.show(sideOf(dx < 0 ? 'left' : 'right'), Math.abs(dx) / MIN_DISTANCE);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const from = start;
      start = null;
      const touch = event.changedTouches[0];
      if (!from || !touch) return indicator.hide();
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      const done = Date.now() - from.at <= MAX_DURATION_MS && Math.abs(dx) >= MIN_DISTANCE && horizontal(dx, dy) && !window.getSelection()?.toString();
      if (!done) return indicator.hide();
      indicator.show(sideOf(dx < 0 ? 'left' : 'right'), 1);
      indicator.commit();
      go(dx < 0 ? 'left' : 'right');
    };
    const onTouchCancel = () => {
      start = null;
      indicator.hide();
    };

    // Trekped (ikki barmoq) gorizontal surish.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || event.ctrlKey || isBlocked(event.target)) return;
      const now = Date.now();
      if (now - lastNav < WHEEL_COOLDOWN_MS) return;
      if (now - wheelAt > 250) wheelSum = 0;
      wheelAt = now;
      wheelSum += event.deltaX;
      // deltaX > 0 — kontent chapga suriladi (barmoq chapga).
      const direction: Direction = wheelSum > 0 ? 'left' : 'right';
      indicator.show(sideOf(direction), Math.abs(wheelSum) / WHEEL_THRESHOLD);
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        wheelSum = 0;
        indicator.hide();
      }, 220);
      if (Math.abs(wheelSum) < WHEEL_THRESHOLD) return;
      wheelSum = 0;
      lastNav = now;
      window.clearTimeout(wheelTimer);
      indicator.commit();
      go(direction);
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    document.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      document.removeEventListener('wheel', onWheel);
      window.clearTimeout(wheelTimer);
      indicator.destroy();
    };
  }, []);
}
