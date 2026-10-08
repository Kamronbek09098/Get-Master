import { useState } from 'react';
import { CheckCircle2, Clock, Copy, Crown, Gift, Hourglass, Sparkles, XCircle } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatDateTime, formatMoney } from '@/lib/utils';
import { ProviderLogo } from '@/features/payment/components/ProviderLogo';
import { useAppStore } from '@/store/app.store';
import { useCancelSubscriptionRequest, useMySubscriptions, usePlans, useRequestSubscription } from './hooks';
import { FEATURE_META } from './meta';
import type { PayMethod, Plan, SubscriptionAudience, SubscriptionRow } from './types';
import './subscription.css';
import { t } from '@/i18n';

const METHOD_LABEL: Record<PayMethod, () => string> = {
  CLICK: () => 'Click',
  PAYME: () => 'Payme',
  UZUM: () => 'Uzum Bank',
  CARD: () => t('Karta orqali o‘tkazma'),
};
const METHOD_HINT: Record<PayMethod, () => string> = {
  CLICK: () => t('Click ilovasi orqali'),
  PAYME: () => t('Payme ilovasi orqali'),
  UZUM: () => t('Uzum Bank ilovasi orqali'),
  CARD: () => t('Karta raqamiga o‘tkazma'),
};
const LOGO: Record<PayMethod, 'CLICK' | 'PAYME' | 'UZUM' | 'OTHER'> = { CLICK: 'CLICK', PAYME: 'PAYME', UZUM: 'UZUM', CARD: 'OTHER' };
const monthsLabel = (months: number) => (months === 12 ? t('1 yil') : t('{months} oy', { months }));

const STATUS_BADGE: Record<string, { label: () => string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ACTIVE: { label: () => t('Faol'), tone: 'success' },
  PENDING: { label: () => t('Kutilmoqda'), tone: 'warning' },
  EXPIRED: { label: () => t('Muddati tugagan'), tone: 'neutral' },
  CANCELED: { label: () => t('Bekor qilingan'), tone: 'neutral' },
  REJECTED: { label: () => t('Rad etilgan'), tone: 'danger' },
};

function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useAppStore((state) => state.pushToast);
  return (
    <div className="gm-sub__copy">
      <span>{label}</span>
      <strong>{value}</strong>
      <button type="button" aria-label={t('{label}ni nusxalash', { label })} onClick={() => void navigator.clipboard?.writeText(value).then(() => toast(t('Nusxa olindi'), 'success'), () => undefined)}>
        <Copy size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function daysLeft(endsAt: string): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000));
}

function PendingCard({ row, instructions, plan }: { row: SubscriptionRow; instructions: { card: string; holder: string; note: string }; plan: Plan | undefined }) {
  const cancel = useCancelSubscriptionRequest();
  const method = (row.method ?? 'CARD') as PayMethod;
  return (
    <section className="gm-sub__card gm-sub__pending" aria-label={t('Kutilayotgan so‘rov')}>
      <div className="gm-sub__pending-head">
        <span className="gm-sub__pending-icon" aria-hidden="true"><Hourglass size={22} /></span>
        <div>
          <h2>{t('To‘lovni yakunlang')}</h2>
          <p>{t('So‘rovingiz qabul qilindi. To‘lovni amalga oshirgach, administrator tasdiqlaydi va obuna avtomatik faollashadi.')}</p>
        </div>
      </div>
      <dl className="gm-sub__rows">
        <div><dt>{t('Reja')}</dt><dd>{plan?.name ?? row.planCode} · {monthsLabel(row.months)}</dd></div>
        <div><dt>{t('To‘lov summasi')}</dt><dd>{formatMoney(row.amount, row.currency)}</dd></div>
        <div><dt>{t('Usul')}</dt><dd>{METHOD_LABEL[method]()}</dd></div>
      </dl>
      <div className="gm-sub__copies">
        <CopyField label={t('Izoh kodi')} value={row.reference} />
        {instructions.card && <CopyField label={t('Karta raqami')} value={instructions.card} />}
        {instructions.holder && <CopyField label={t('Qabul qiluvchi')} value={instructions.holder} />}
      </div>
      <p className="gm-sub__note">{instructions.note || t('To‘lov izohiga yuqoridagi kodni yozing, shunda to‘lovingizni tezroq topamiz.')}</p>
      {cancel.isError && <Alert tone="danger">{getErrorMessage(cancel.error)}</Alert>}
      <div className="gm-sub__pending-actions">
        <Button variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate(row.id)}>
          <XCircle size={16} aria-hidden="true" /> {t('So‘rovni bekor qilish')}
        </Button>
      </div>
    </section>
  );
}

/** Obuna sahifasi (mijoz «Plus» yoki usta «Pro»): imkoniyatlar, muddat tanlash, to‘lov usuli, so‘rov va tarix. */
export function SubscriptionView({ audience }: { audience: SubscriptionAudience }) {
  const plans = usePlans();
  const mine = useMySubscriptions();
  const request = useRequestSubscription();
  const [months, setMonths] = useState<1 | 3 | 12>(3);
  const [method, setMethod] = useState<PayMethod>('CLICK');

  if (plans.isLoading || mine.isLoading) return <PageLoader />;
  if (plans.isError) return <Alert tone="danger">{getErrorMessage(plans.error)}</Alert>;
  if (mine.isError) return <Alert tone="danger">{getErrorMessage(mine.error)}</Alert>;
  const plan = plans.data?.plans.find((item) => item.audience === audience);
  const data = mine.data;
  if (!plan || !data) return null;

  const active = audience === 'CUSTOMER' ? data.customer : data.master;
  const pending = data.pending.find((row) => row.audience === audience);
  const price = plan.prices.find((item) => item.months === months);
  const methods = (plans.data?.methods ?? []).filter((item): item is PayMethod => item in METHOD_LABEL);
  const history = data.history.filter((row) => row.audience === audience);
  const left = active ? daysLeft(active.endsAtTotal) : 0;
  const progress = active && active.startsAt ? Math.min(100, Math.max(4, (left / Math.max(1, (new Date(active.endsAtTotal).getTime() - new Date(active.startsAt).getTime()) / 86_400_000)) * 100)) : 0;

  return (
    <div className={cx('gm-sub', audience === 'MASTER' ? 'gm-sub--master' : 'gm-sub--customer')}>
      <section className="gm-sub__hero">
        <span className="gm-sub__crown" aria-hidden="true"><Crown size={30} /></span>
        <div className="gm-sub__hero-text">
          <p className="gm-sub__eyebrow">GetMaster</p>
          <h1>{plan.name}</h1>
          <p>{audience === 'CUSTOMER' ? t('Muloqot va buyurtmalar ustidan to‘liq nazorat') : t('Ko‘proq mijoz, ko‘proq ishonch')}</p>
        </div>
        {active ? (
          <div className="gm-sub__status">
            <Badge tone="success"><CheckCircle2 size={14} /> {t('Faol')}</Badge>
            <strong>{t('{days} kun qoldi', { days: left })}</strong>
            <span>{t('{date} gacha', { date: formatDate(active.endsAtTotal) })}</span>
            <i className="gm-sub__bar" aria-hidden="true"><b style={{ width: `${progress}%` }} /></i>
          </div>
        ) : (
          <div className="gm-sub__status gm-sub__status--off">
            <Badge tone="neutral"><Sparkles size={14} /> {t('Obuna yo‘q')}</Badge>
            <strong>{t('Imkoniyatlarni oching')}</strong>
          </div>
        )}
      </section>

      <section className="gm-sub__features" aria-label={t('Imkoniyatlar')}>
        {plan.features.map((feature) => {
          const meta = FEATURE_META[feature];
          const Icon = meta.icon;
          return (
            <article key={feature} className="gm-sub__feature">
              <span aria-hidden="true"><Icon size={20} /></span>
              <div>
                <h3>{meta.title()}</h3>
                <p>{meta.text()}</p>
              </div>
            </article>
          );
        })}
      </section>

      {pending ? (
        <PendingCard row={pending} instructions={data.instructions} plan={plan} />
      ) : (
        <section className="gm-sub__card" aria-label={t('Obuna bo‘lish')}>
          <h2>{active ? t('Obunani uzaytirish') : t('Obuna bo‘lish')}</h2>
          {active && <p className="gm-sub__hint">{t('Yangi muddat hozirgi obuna tugagach avtomatik boshlanadi, kunlar yo‘qolmaydi.')}</p>}

          <div className="gm-sub__periods" role="radiogroup" aria-label={t('Muddat')}>
            {plan.prices.map((item) => (
              <label key={item.months} className={cx('gm-sub__period', months === item.months && 'is-selected')}>
                <input type="radio" name="period" checked={months === item.months} onChange={() => setMonths(item.months)} />
                {item.months === 3 && <em>{t('Mashhur')}</em>}
                {item.savingPercent > 0 && <b className="gm-sub__save">−{item.savingPercent}%</b>}
                <strong>{monthsLabel(item.months)}</strong>
                <span className="gm-sub__price">{formatMoney(item.price, 'UZS')}</span>
                <small>{t('oyiga {price}', { price: formatMoney(Math.round(item.price / item.months), 'UZS') })}</small>
              </label>
            ))}
          </div>

          <h3 className="gm-sub__sub">{t('To‘lov usuli')}</h3>
          <div className="gm-sub__methods" role="radiogroup" aria-label={t('To‘lov usuli')}>
            {methods.map((item) => (
              <label key={item} className={cx('gm-sub__method', method === item && 'is-selected')}>
                <input type="radio" name="method" checked={method === item} onChange={() => setMethod(item)} />
                <ProviderLogo provider={LOGO[item]} size={34} />
                <span>
                  <strong>{METHOD_LABEL[item]()}</strong>
                  <small>{METHOD_HINT[item]()}</small>
                </span>
              </label>
            ))}
          </div>

          {request.isError && <Alert tone="danger">{getErrorMessage(request.error)}</Alert>}
          <div className="gm-sub__buy">
            <div>
              <small>{t('Jami')}</small>
              <strong>{price ? formatMoney(price.price, 'UZS') : '—'}</strong>
            </div>
            <Button size="lg" loading={request.isPending} disabled={!price} onClick={() => request.mutate({ planCode: plan.code, months, method })}>
              <Crown size={18} aria-hidden="true" /> {active ? t('Uzaytirish') : t('Obuna bo‘lish')}
            </Button>
          </div>
          <p className="gm-sub__fine">{t('To‘lov tasdiqlangach obuna faollashadi. Istalgan vaqtda so‘rovni bekor qilishingiz mumkin.')}</p>
        </section>
      )}

      {history.length > 0 && (
        <section className="gm-sub__card" aria-label={t('Obuna tarixi')}>
          <h2>{t('Obuna tarixi')}</h2>
          <ul className="gm-sub__history">
            {history.map((row) => {
              const badge = STATUS_BADGE[row.status] ?? { label: () => row.status, tone: 'neutral' as const };
              return (
                <li key={row.id}>
                  <span className="gm-sub__h-icon" aria-hidden="true">{row.source === 'GRANT' ? <Gift size={17} /> : <Clock size={17} />}</span>
                  <div>
                    <strong>{plan.name} · {monthsLabel(row.months)}</strong>
                    <small>
                      {row.startsAt && row.endsAt ? `${formatDate(row.startsAt)} – ${formatDate(row.endsAt)}` : formatDateTime(row.createdAt)}
                      {row.source === 'GRANT' ? ` · ${t('Sovg‘a')}` : ''}
                      {row.rejectReason ? ` · ${row.rejectReason}` : ''}
                    </small>
                  </div>
                  <Badge tone={badge.tone}>{badge.label()}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
