import { Check } from 'lucide-react';
import { cx } from '@/lib/utils';
import './RequestSteps.css';

const STEPS = ['Muammo', 'Rasm', 'Yuborish'];

/** So‘rov yaratish bosqichlari: 1 — muammo, 2 — rasm biriktirish, 3 — yuborish. */
export function RequestSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="gm-steps" aria-label="Bosqichlar">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'current' : 'todo';
        return (
          <li key={label} className={cx('gm-steps__item', `gm-steps__item--${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="gm-steps__dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : number}</span>
            <span className="gm-steps__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
