import { Check } from 'lucide-react';
import { cx } from '@/lib/utils';
import type { OrderStatus } from '@/types/common';
import { FLOW_STEPS, stepIndex } from '../order-flow';

export function OrderProgress({ status }: { status: OrderStatus }) {
  const terminal = status === 'CANCELLED' || status === 'EXPIRED' || status === 'DISPUTED';
  const current = terminal ? -1 : stepIndex(status);

  return (
    <ol className={cx('gm-oprogress', terminal && 'gm-oprogress--off')} aria-label="Buyurtma bosqichlari">
      {FLOW_STEPS.map((step, index) => {
        const state = current > index || status === 'COMPLETED' ? 'done' : current === index ? 'current' : 'todo';
        return (
          <li key={step.status} className={cx('gm-oprogress__step', `gm-oprogress__step--${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="gm-oprogress__dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
            <span className="gm-oprogress__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
