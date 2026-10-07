import { useId } from 'react';
import type { PaymentProvider } from '@/types/common';

/**
 * To‘lov usullari belgilari: naqd pul va Payme — rasm (public/payment), Click / Uzum — inline SVG.
 * Click / Payme / Uzum — brend ranglaridagi belgilar. Rasmiy fayllar bo‘lsa, shu yerda almashtiriladi.
 */
export function ProviderLogo({ provider, size = 46 }: { provider: PaymentProvider; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const common = { width: size, height: size, viewBox: '0 0 48 48', 'aria-hidden': true, focusable: false } as const;

  if (provider === 'CASH') {
    return (
      <img
        src="/payment/cash.png"
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{ display: 'block', borderRadius: size * 0.27, objectFit: 'contain' }}
      />
    );
  }

  if (provider === 'CLICK') {
    // Rasmiy belgi: ko‘k yumaloqlangan romb, ichida shunday shakldagi teshik
    return (
      <svg {...common}>
        <rect x=".6" y=".6" width="46.8" height="46.8" rx="13" fill="#fff" stroke="#e1e6f0" strokeWidth="1.2" />
        <g transform="translate(24 24) rotate(45) scale(1.2)" fillRule="evenodd" fill="#0069ff">
          <path d="M-9.9 0C-9.9 -8.514 -8.514 -9.9 0 -9.9C8.514 -9.9 9.9 -8.514 9.9 0C9.9 8.514 8.514 9.9 0 9.9C-8.514 9.9 -9.9 8.514 -9.9 0Z M-3.9 0C-3.9 -3.354 -3.354 -3.9 0 -3.9C3.354 -3.9 3.9 -3.354 3.9 0C3.9 3.354 3.354 3.9 0 3.9C-3.354 3.9 -3.9 3.354 -3.9 0Z" />
        </g>
      </svg>
    );
  }

  if (provider === 'PAYME') {
    // Rasmiy belgi rasm sifatida: yozuvlar shriftga bog‘liq bo‘lmaydi va surilmaydi
    return (
      <img
        src="/payment/payme.png"
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{ display: 'block', borderRadius: size * 0.27, border: '1px solid #e1e6f0', background: '#fff', objectFit: 'contain' }}
      />
    );
  }

  if (provider === 'UZUM') {
    // Uzum Bank ilovasi belgisi: yashil fonda binafsha «S» tasma, oq «U» va «bank» yozuvi
    return (
      <svg {...common}>
        <defs>
          <clipPath id={`${uid}u`}>
            <rect width="48" height="48" rx="13" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid}u)`}>
          <rect width="48" height="48" fill="#74e04b" />
          <path d="M17 0H35L48 12V16.5C48 21 42.5 23 42.5 27C42.5 31 48 31 48 34L31 48H0V31C0 26 6 25 6 21C6 17 0 16 0 14Z" fill="#7a00ff" />
        </g>
        <path d="M16.6 14.5v8.6a7.4 7.4 0 0 0 14.8 0v-8.6" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M24 9.2v8.4" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        <text x="24" y="41.6" textAnchor="middle" fontFamily="Inter, Arial, Helvetica, sans-serif" fontWeight="800" fontSize="8.6" letterSpacing="-0.2" fill="#fff">
          bank
        </text>
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect width="48" height="48" rx="13" fill="#e5e9f2" />
      <rect x="9" y="14" width="30" height="20" rx="4" fill="none" stroke="#5b6785" strokeWidth="2" />
      <path d="M9 21h30" stroke="#5b6785" strokeWidth="2" />
    </svg>
  );
}
