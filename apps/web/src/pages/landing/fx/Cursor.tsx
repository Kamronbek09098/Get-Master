import { useEffect, useRef } from 'react';
import { useFinePointer } from './useFinePointer';

/** Maxsus kursor: nuqta + ergashuvchi halqa; havola/tugma ustida kattalashadi. Faqat sichqonchali qurilmalarda. */
export function Cursor() {
  const fine = useFinePointer();
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fine) return;
    document.documentElement.classList.add('gm-has-cursor');
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      const target = event.target as HTMLElement | null;
      const hot = !!target?.closest('a, button, [role="button"], input, textarea, select, label');
      ring.current?.classList.toggle('is-hot', hot);
    };
    const loop = () => {
      frame = requestAnimationFrame(loop);
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    };
    loop();
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove('gm-has-cursor');
      window.removeEventListener('pointermove', onMove);
    };
  }, [fine]);

  if (!fine) return null;
  return (
    <>
      <div ref={ring} className="gm-cursor-ring" aria-hidden="true" />
      <div ref={dot} className="gm-cursor-dot" aria-hidden="true" />
    </>
  );
}
