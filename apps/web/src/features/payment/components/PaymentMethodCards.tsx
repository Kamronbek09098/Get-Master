import { Banknote, Check, CreditCard } from 'lucide-react';
import { cx } from '@/lib/utils';
import type { PaymentProvider } from '@/types/common';
import { PROVIDER_OPTIONS } from '../labels';
import './Payment.css';
import { t } from '@/i18n';

const BRAND: Partial<Record<PaymentProvider, string>> = { CLICK: 'click', PAYME: 'payme', UZUM: 'uzum' };

/** To‘lov usulini tanlash uchun kartalar (radio guruh). */
export function PaymentMethodCards({
  value,
  onChange,
  current,
  compact = false,
  disabled = false,
}: {
  value: PaymentProvider | '';
  onChange: (value: PaymentProvider) => void;
  /** Buyurtmada hozir yozilgan usul (belgi bilan ko‘rsatiladi). */
  current?: PaymentProvider | null;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={cx('gm-paym', compact && 'gm-paym--compact')} role="radiogroup" aria-label={t('To‘lov usuli')}>
      {PROVIDER_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label key={option.value} className={cx('gm-paym__card', selected && 'gm-paym__card--selected', disabled && 'gm-paym__card--disabled')}>
            <input type="radio" name="payment-method" value={option.value} checked={selected} disabled={disabled} onChange={() => onChange(option.value)} />
            <span className={cx('gm-paym__icon', BRAND[option.value] && `gm-paym__icon--${BRAND[option.value]}`)} aria-hidden="true">
              {option.value === 'CASH' ? <Banknote size={20} /> : BRAND[option.value] ? option.label[0] : <CreditCard size={20} />}
            </span>
            <span className="gm-paym__text">
              <strong>
                {option.label}
                {current === option.value && <em>{t('Tanlangan')}</em>}
              </strong>
              {!compact && <small>{option.hint}</small>}
            </span>
            <span className="gm-paym__check" aria-hidden="true">
              {selected && <Check size={14} />}
            </span>
          </label>
        );
      })}
    </div>
  );
}
