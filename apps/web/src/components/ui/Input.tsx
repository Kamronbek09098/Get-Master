import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cx } from '@/lib/utils';
import './Field.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Input ichida chapda ko‘rsatiladigan doimiy qism, masalan telefon kodi «+998». */
  prefix?: string;
  /** Qiymatni kiritish paytida formatlaydi (masalan, telefon: «95 959 49 44»). */
  formatValue?: (value: string) => string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, required, className, type, prefix, formatValue, onChange, ...rest }, ref) => {
    const generatedId = useId();
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === 'password';
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="gm-field">
        <label htmlFor={inputId} className="gm-field__label">
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        <div className={cx('gm-field__wrap', isPassword && 'gm-field__wrap--password', prefix && 'gm-field__wrap--prefixed')}>
          {prefix && (
            <span className="gm-field__prefix" aria-hidden="true">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={isPassword && revealed ? 'text' : type}
            required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cx('gm-field__control', error && 'gm-field__control--error', className)}
            onChange={
              formatValue
                ? (event) => {
                    event.target.value = formatValue(event.target.value);
                    onChange?.(event);
                  }
                : onChange
            }
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              className="gm-field__reveal"
              aria-label={revealed ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
              aria-pressed={revealed}
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {hint && !error && (
          <p id={hintId} className="gm-field__hint">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="gm-field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
