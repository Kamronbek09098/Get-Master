import type { ReactNode } from 'react';

/**
 * Xizmat turlari uchun haqiqiy buyumlar tasviri (ikki-uch tonli, yassi): jo‘mrak, rozetka, konditsioner, kir yuvish mashinasi,
 * bolg‘a va kalit, purkagich, divan, qulf. Oddiy tomchi yoki qor parchasi o‘rniga odamlar kundalik ko‘radigan narsalar.
 */
const Faucet = () => (
  <>
    <rect x="6" y="34" width="17" height="5" rx="2" fill="#64748b" />
    <rect x="10" y="19" width="9" height="16" rx="2" fill="#94a3b8" />
    <rect x="10" y="12" width="27" height="9" rx="4" fill="#94a3b8" />
    <rect x="13" y="14" width="21" height="2.4" rx="1.2" fill="#e2e8f0" />
    <rect x="30" y="19" width="7" height="9" rx="2" fill="#94a3b8" />
    <rect x="28.5" y="27" width="10" height="3.6" rx="1.6" fill="#64748b" />
    <rect x="21.5" y="6" width="4" height="7" rx="1" fill="#64748b" />
    <rect x="15" y="3.5" width="17" height="4.6" rx="2.3" fill="#2563eb" />
    <path d="M33.5 33.5c0 0-3.2 4-3.2 6.2a3.2 3.2 0 0 0 6.4 0c0-2.2-3.2-6.2-3.2-6.2Z" fill="#38bdf8" />
    <path d="M32.4 38.2a1.6 1.6 0 0 0 1.2 1.9" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    <circle cx="33.5" cy="45" r="1.4" fill="#7dd3fc" />
  </>
);

const Socket = () => (
  <>
    <rect x="6" y="7" width="34" height="34" rx="9" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
    <circle cx="23" cy="24" r="12.5" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
    <circle cx="17.5" cy="24" r="2.5" fill="#1e293b" />
    <circle cx="28.5" cy="24" r="2.5" fill="#1e293b" />
    <rect x="21.5" y="10.5" width="3" height="3.2" rx="1" fill="#94a3b8" />
    <rect x="21.5" y="34.3" width="3" height="3.2" rx="1" fill="#94a3b8" />
    <circle cx="38" cy="10" r="8" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
    <path d="M39.2 4.8 34.6 11.2h3.2l-1 4.6 4.6-6.4h-3.2Z" fill="#fff" />
  </>
);

const Conditioner = () => (
  <>
    <rect x="4" y="8" width="40" height="18" rx="5.5" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
    <rect x="8.5" y="12" width="31" height="2.6" rx="1.3" fill="#cbd5e1" />
    <rect x="7" y="20.5" width="34" height="4" rx="2" fill="#94a3b8" />
    <circle cx="38.5" cy="17" r="1.6" fill="#22c55e" />
    <path d="M12 31c2.6 2 2.6 5 0 7s-2.6 5 0 7M24 31c2.6 2 2.6 5 0 7s-2.6 5 0 7M36 31c2.6 2 2.6 5 0 7s-2.6 5 0 7" stroke="#38bdf8" strokeWidth="2.6" strokeLinecap="round" fill="none" />
  </>
);

const Washer = () => (
  <>
    <rect x="8" y="3.5" width="32" height="41" rx="5.5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
    <rect x="9" y="13" width="30" height="1.8" fill="#e2e8f0" />
    <circle cx="16" cy="8.4" r="2.5" fill="#2563eb" />
    <rect x="23" y="6.4" width="12" height="4" rx="2" fill="#bfdbfe" />
    <circle cx="24" cy="29" r="11.5" fill="#94a3b8" />
    <circle cx="24" cy="29" r="9" fill="#38bdf8" />
    <path d="M16.2 30.2q3.9-3.4 7.8 0t7.8 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <ellipse cx="20.2" cy="24.6" rx="2.6" ry="1.4" transform="rotate(-35 20.2 24.6)" fill="#fff" opacity=".6" />
  </>
);

const Tools = () => (
  <>
    <g transform="rotate(45 24 24)">
      <rect x="21" y="12" width="6" height="32" rx="3" fill="#94a3b8" />
      <path fillRule="evenodd" d="M24 2.5a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 1 0 0-13.6ZM21.8 2.5h4.4v6h-4.4Z" fill="#94a3b8" />
    </g>
    <g transform="rotate(-45 24 24)">
      <rect x="22" y="13" width="4.4" height="31" rx="2.2" fill="#b45309" />
      <rect x="12" y="5" width="23" height="10.5" rx="2.6" fill="#475569" />
      <rect x="14" y="7" width="19" height="2.2" rx="1.1" fill="#94a3b8" />
    </g>
  </>
);

const Spray = () => (
  <>
    <rect x="13" y="19" width="19" height="25" rx="5.5" fill="#60a5fa" />
    <rect x="16" y="22" width="4" height="19" rx="2" fill="#93c5fd" />
    <rect x="17" y="28" width="12" height="9" rx="2" fill="#fff" opacity=".9" />
    <path d="M23 29.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" fill="#f59e0b" />
    <rect x="18.5" y="14" width="8" height="6" fill="#1d4ed8" />
    <rect x="16.5" y="8" width="18" height="7.4" rx="2.6" fill="#1d4ed8" />
    <path d="M32 12h4.6v8q0 3-3 3h-2.2Z" fill="#2563eb" />
    <rect x="34.4" y="9.6" width="5" height="4" rx="1.6" fill="#334155" />
    <circle cx="43" cy="8" r="2" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
    <circle cx="41.5" cy="15" r="1.4" fill="#7dd3fc" />
    <path d="M8 6l1.6 4.4L14 12l-4.4 1.6L8 18 6.4 13.6 2 12l4.4-1.6Z" fill="#fbbf24" />
  </>
);

const Sofa = () => (
  <>
    <rect x="8" y="11" width="32" height="19" rx="6.5" fill="#8b5cf6" />
    <rect x="3" y="20" width="9" height="16" rx="4.5" fill="#7c3aed" />
    <rect x="36" y="20" width="9" height="16" rx="4.5" fill="#7c3aed" />
    <rect x="10" y="22" width="13.5" height="11" rx="4" fill="#a78bfa" />
    <rect x="24.5" y="22" width="13.5" height="11" rx="4" fill="#a78bfa" />
    <rect x="5.5" y="32" width="37" height="5.5" rx="2.4" fill="#6d28d9" />
    <rect x="9" y="37" width="3.4" height="5.4" rx="1.2" fill="#475569" />
    <rect x="35.6" y="37" width="3.4" height="5.4" rx="1.2" fill="#475569" />
  </>
);

const Lock = () => (
  <>
    <path d="M16 22v-6a8 8 0 0 1 16 0v6" stroke="#64748b" strokeWidth="4.6" strokeLinecap="round" fill="none" />
    <rect x="9" y="21" width="30" height="23" rx="6.5" fill="#f59e0b" />
    <rect x="12.5" y="24" width="5" height="16" rx="2.5" fill="#fcd34d" />
    <circle cx="24" cy="30.5" r="3.6" fill="#78350f" />
    <rect x="22.5" y="32" width="3" height="7" rx="1.4" fill="#78350f" />
  </>
);

const ART: Record<string, { node: ReactNode; tint: string }> = {
  Santexnika: { node: <Faucet />, tint: '#e0f2fe' },
  Elektr: { node: <Socket />, tint: '#fef3c7' },
  Konditsioner: { node: <Conditioner />, tint: '#e0f7ff' },
  'Maishiy texnika': { node: <Washer />, tint: '#e6eaff' },
  Tamirlash: { node: <Tools />, tint: '#eceff4' },
  Tozalash: { node: <Spray />, tint: '#dff5ff' },
  Mebel: { node: <Sofa />, tint: '#f0e9ff' },
  'Eshik va qulflar': { node: <Lock />, tint: '#fff1d6' },
};

const key = (name: string) => name.replace(/[’'‘`]/g, '').replace(/Ta.?mirlash/i, 'Tamirlash');

/** Xizmat nomiga mos haqiqiy buyum tasviri; topilmasa `null` (chaqiruvchi oddiy ikonkaga qaytadi). */
export function hasServiceArt(name: string): boolean {
  return key(name) in ART;
}

export function ServiceArt({ name, size = 40 }: { name: string; size?: number }) {
  const art = ART[key(name)];
  if (!art) return null;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      {art.node}
    </svg>
  );
}

export function serviceTint(name: string): string {
  return ART[key(name)]?.tint ?? '#e8f0ff';
}
