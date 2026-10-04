import { useEffect, useRef } from 'react';
import { t } from '@/i18n';
import { env } from '@/lib/env';
import './cursor.css';

/**
 * GetMaster kursor tizimi (butun ilova bo‘ylab, bitta joyda).
 *  - Odatiy holat: kichik nuqta (yengil kechikish bilan ergashadi).
 *  - Bosiladigan element: nuqta atrofida halqa paydo bo‘ladi, element tomon sal tortiladi.
 *  - Asosiy CTA (`.gm-button--primary`, `data-cursor="cta"`): halqa tugma o‘lchamiga moslashadi (matn yopilmaydi).
 *  - `data-cursor="view|open|explore|drag|before-after|profile"`: halqa ichida qisqa yorliq.
 *  - Matn kiritish maydonlari (`input`, `textarea`, `contenteditable`) va `data-cursor="native"`: oddiy brauzer kursori.
 * Faqat sichqonchali (hover + fine) qurilmada ishlaydi; sensorli qurilmada umuman chiqmaydi.
 * Kadrlar React orqali emas, `requestAnimationFrame` + `transform` orqali yangilanadi.
 */
const LABELS: Record<string, () => string> = {
  view: () => t('Ko‘rish'),
  open: () => t('Ochish'),
  explore: () => t('Ko‘rib chiqish'),
  drag: () => t('Surish'),
  'before-after': () => t('Oldin / Keyin'),
  profile: () => t('Profilni ko‘rish'),
};

const NATIVE =
  'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, select, [contenteditable=""], [contenteditable="true"], [data-cursor="native"]';
const CLICKABLE = 'a[href], button, summary, [role="button"], [role="tab"], [role="link"], label[for], [data-cursor]';
const CTA = '.gm-button--primary, [data-cursor="cta"]';

const DOT = 6;
const HOT = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type Mode = 'idle' | 'hot' | 'cta' | 'label' | 'native';

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Admin paneli — zich ish interfeysi: oddiy brauzer kursori qoladi.
    if (env.appRole === 'ADMIN' || typeof window.matchMedia !== 'function') return;
    const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fineQuery.matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const text = textRef.current;
    if (!dot || !ring || !text) return;

    const root = document.documentElement;
    const reduced = reduceQuery.matches;
    const kDot = reduced ? 1 : 0.38;
    const kRing = reduced ? 1 : 0.2;
    const kSize = reduced ? 1 : 0.24;

    let px = -100;
    let py = -100;
    let dx = px;
    let dy = py;
    let rx = px;
    let ry = py;
    let rw = DOT;
    let rh = DOT;
    let rr = 50;
    let ro = 0;
    let mode: Mode = 'idle';
    let host: Element | null = null;
    let visible = false;
    let frame = 0;
    let seen = false;

    const targets = () => {
      let tx = px;
      let ty = py;
      let tw = DOT;
      let th = DOT;
      let tr = 50;
      let to = 0;
      if ((mode === 'hot' || mode === 'label' || mode === 'cta') && host) {
        const rect = host.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        if (mode === 'label') {
          // Yorliq kursor yonida kichik tabletka: element matnini yopmaydi.
          tw = (text.textContent?.length ?? 4) * 7.6 + 24;
          th = 26;
          tr = 13;
          tx = px + tw / 2 + 14;
          ty = py + 26;
        } else if (mode === 'cta') {
          // Halqa tugmani o‘rab oladi: markazga ko‘proq tortiladi.
          tx = lerp(px, cx, 0.85);
          ty = lerp(py, cy, 0.85);
          tw = rect.width + 12;
          th = rect.height + 12;
          tr = Math.min(parseFloat(getComputedStyle(host).borderTopLeftRadius) || 10, 999) + 6;
        } else {
          // Yengil «magnit»: halqa element markaziga 18% tortiladi.
          tx = lerp(px, cx, 0.18);
          ty = lerp(py, cy, 0.18);
          tw = th = HOT;
        }
        to = 1;
      }
      return { tx, ty, tw, th, tr, to };
    };

    const render = () => {
      frame = 0;
      if (!visible) return;
      const { tx, ty, tw, th, tr, to } = targets();
      dx = lerp(dx, px, kDot);
      dy = lerp(dy, py, kDot);
      rx = lerp(rx, tx, kRing);
      ry = lerp(ry, ty, kRing);
      rw = lerp(rw, tw, kSize);
      rh = lerp(rh, th, kSize);
      rr = lerp(rr, tr, kSize);
      ro = lerp(ro, to, kSize);
      dot.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
      ring.style.transform = `translate3d(${(rx - rw / 2).toFixed(2)}px, ${(ry - rh / 2).toFixed(2)}px, 0)`;
      ring.style.width = `${rw.toFixed(1)}px`;
      ring.style.height = `${rh.toFixed(1)}px`;
      ring.style.borderRadius = `${rr.toFixed(1)}px`;
      ring.style.opacity = ro.toFixed(3);
      const settled =
        Math.abs(dx - px) < 0.1 && Math.abs(dy - py) < 0.1 && Math.abs(rx - tx) < 0.1 && Math.abs(ry - ty) < 0.1 &&
        Math.abs(rw - tw) < 0.3 && Math.abs(rh - th) < 0.3 && Math.abs(ro - to) < 0.01;
      // Mode «hot/cta» da element sahifa bilan siljishi mumkin — shu sabab faol rejimda tsikl davom etadi.
      if (!settled || mode === 'hot' || mode === 'cta' || mode === 'label') frame = requestAnimationFrame(render);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    const setMode = (next: Mode, el: Element | null, label = '') => {
      host = el;
      if (next === mode && text.textContent === label) return;
      mode = next;
      ring.classList.toggle('is-label', next === 'label');
      ring.classList.toggle('is-cta', next === 'cta');
      text.textContent = label;
      dot.classList.toggle('is-native', next === 'native');
      dot.classList.toggle('is-hot', next === 'hot' || next === 'cta' || next === 'label');
      kick();
    };

    const resolve = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      if (!el) return setMode('idle', null);
      if (el.closest(NATIVE)) return setMode('native', null);
      const clickable = el.closest(CLICKABLE);
      if (!clickable || (clickable as HTMLButtonElement).disabled || clickable.getAttribute('aria-disabled') === 'true') return setMode('idle', null);
      const key = clickable.getAttribute('data-cursor') ?? '';
      const compact = window.innerWidth < 900; // planshet: yorliqsiz, soddalashtirilgan
      if (key && key !== 'cta' && key !== 'native' && LABELS[key] && !compact) return setMode('label', clickable, LABELS[key]!());
      if (clickable.matches(CTA) || key === 'cta') return setMode('cta', clickable);
      return setMode('hot', clickable);
    };

    const show = () => {
      if (visible) return;
      visible = true;
      root.classList.add('gm-cursor-on');
      dot.style.opacity = '1';
    };
    const hide = () => {
      visible = false;
      root.classList.remove('gm-cursor-on');
      dot.style.opacity = '0';
      ring.style.opacity = '0';
      ro = 0;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      px = event.clientX;
      py = event.clientY;
      if (!seen) {
        seen = true;
        dx = rx = px;
        dy = ry = py;
      }
      show();
      kick();
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') resolve(event.target);
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') ring.classList.add('is-down');
    };
    const onUp = () => ring.classList.remove('is-down');
    const onLeave = () => hide();
    const onScroll = () => {
      if (mode !== 'idle') kick();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      root.classList.remove('gm-cursor-on');
    };
  }, []);

  return (
    <div className="gm-cursor" aria-hidden="true">
      <div ref={ringRef} className="gm-cursor__ring">
        <span ref={textRef} className="gm-cursor__label" />
      </div>
      <div ref={dotRef} className="gm-cursor__dot" />
    </div>
  );
}
