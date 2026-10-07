import { Check, X } from 'lucide-react';
import { cx, formatDateTime } from '@/lib/utils';
import type { OrderStatus } from '@/types/common';
import { ACTOR_TEXT, FLOW_STEPS, STATUS_TEXT, stepIndex } from '../order-flow';
import { useOrderTimeline } from '../hooks/useOrders';
import { t } from '@/i18n';

/** Bosqich nomlari — voqea shaklida (kim nima qildi). */
const STEP_LABEL: Record<string, string> = {
  BOOKED: t('Buyurtma yaratildi'),
  CONFIRMED: t('Usta tasdiqladi'),
  ON_THE_WAY: t('Usta yo‘lga chiqdi'),
  ARRIVED: t('Usta yetib keldi'),
  IN_PROGRESS: t('Ish boshlandi'),
  WAITING_CONFIRMATION: t('Ish topshirildi'),
  COMPLETED: t('Buyurtma yakunlandi'),
};

const FLOW = new Set<OrderStatus>(FLOW_STEPS.map((step) => step.status));

/** Kun va soat: «27 sen, 15:22» (yil bo‘lmaydi — bosqich chizig‘i ixcham turishi uchun). */
const shortTime = (value: string) => formatDateTime(value).replace(/ \d{4},/, ',');

/**
 * Buyurtma bosqichlari: har bir o‘tilgan bosqich ostida qachon va kim tomonidan bajarilgani ko‘rsatiladi
 * (alohida «tarix» kartasi shu yerga birlashtirilgan). Bekor qilish/nizo kabi bosqichdan tashqari holatlar — pastda.
 */
export function OrderProgress({ status, orderId }: { status: OrderStatus; orderId?: string }) {
  const timeline = useOrderTimeline(orderId ?? '');
  const terminal = status === 'CANCELLED' || status === 'EXPIRED' || status === 'DISPUTED';
  const current = terminal ? -1 : stepIndex(status);
  const entries = orderId ? (timeline.data ?? []) : [];
  const stepEntry = (step: OrderStatus) => [...entries].reverse().find((entry) => entry.newStatus === step);
  const stop = terminal ? [...entries].reverse().find((entry) => entry.newStatus === status) : undefined;
  // Bekor qilingan/nizoli buyurtmada: faqat haqiqatan o‘tilgan bosqichlar + oxirgi «to‘xtatildi» bosqichi (kulrang bo‘sh qadamlar ko‘rsatilmaydi).
  const steps = terminal ? FLOW_STEPS.filter((step) => stepEntry(step.status)) : FLOW_STEPS;
  const extra = entries.filter((entry) => !FLOW.has(entry.newStatus) && !(terminal && entry.id === stop?.id));

  return (
    <div className="gm-oprogress-wrap">
      <ol className={cx('gm-oprogress', terminal && 'gm-oprogress--stopped')} aria-label={t('Buyurtma bosqichlari')}>
        {steps.map((step, index) => {
          const state = terminal || current > index || status === 'COMPLETED' ? 'done' : current === index ? 'current' : 'todo';
          const entry = state === 'todo' ? undefined : stepEntry(step.status);
          return (
            <li key={step.status} className={cx('gm-oprogress__step', `gm-oprogress__step--${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="gm-oprogress__dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
              <span className="gm-oprogress__label">{STEP_LABEL[step.status] ?? step.label}</span>
              {entry && (
                <small className="gm-oprogress__time">{shortTime(entry.createdAt)}</small>
              )}
            </li>
          );
        })}
        {terminal && (
          <li className="gm-oprogress__step gm-oprogress__step--stop">
            <span className="gm-oprogress__dot">
              <X size={14} strokeWidth={3} />
            </span>
            <span className="gm-oprogress__label">{STATUS_TEXT[status]}</span>
            {stop && <small className="gm-oprogress__time">{shortTime(stop.createdAt)}</small>}
          </li>
        )}
      </ol>
      {extra.length > 0 && (
        <ul className="gm-oprogress__extra">
          {extra.map((entry) => (
            <li key={entry.id}>
              <strong>{STATUS_TEXT[entry.newStatus]}</strong>
              <span>
                {ACTOR_TEXT[entry.actorType]} · {shortTime(entry.createdAt)}
              </span>
              {entry.reason && <em>“{entry.reason}”</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
