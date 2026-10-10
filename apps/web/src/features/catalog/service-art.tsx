import { useState } from 'react';
import './service-art.css';
import { Brush, Droplets, Flower2, Hammer, HardHat, Lamp, PaintRoller, Palette, Refrigerator, Sofa, Sparkles, Truck, Wind, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Kategoriya nomiga qarab ikona (kalit so‘zlar bo‘yicha); topilmasa — umumiy asbob. */
const ICONS: Array<[RegExp, LucideIcon]> = [
  [/santex|suv|kran|quvur/i, Droplets],
  [/elektr|chiroq|rozetka|sim/i, Zap],
  [/tozalash|tozala|kimyoviy/i, Sparkles],
  [/qurilish|beton|devor|pol|plitka/i, HardHat],
  [/ta.?mir|remont|kafel/i, Hammer],
  [/dizayn|interyer/i, Palette],
  [/bo.?yoq|bo.?yash|shpatl/i, PaintRoller],
  [/mebel/i, Sofa],
  [/konditsioner|sovutgich|isitish|ventil/i, Wind],
  [/maishiy|texnika|kir yuv|muzlatgich/i, Refrigerator],
  [/bog|hovli|gul|o.simlik/i, Flower2],
  [/ko.chirish|yuk|transport/i, Truck],
  [/yoritish|lampa/i, Lamp],
  [/pardoz|dekor/i, Brush],
];

export function categoryIcon(name: string): LucideIcon {
  return ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Wrench;
}

const PALETTES = [
  { a: '#dbe9ff', b: '#bcd4ff', fg: '#2f6fed' },
  { a: '#dff5ea', b: '#bfe8d3', fg: '#12a672' },
  { a: '#ffeccf', b: '#ffd9a1', fg: '#d97706' },
  { a: '#eee8ff', b: '#d9ccff', fg: '#7c5cf0' },
  { a: '#ffe1e6', b: '#ffc4cd', fg: '#d6455d' },
  { a: '#d9f3f4', b: '#b3e6e8', fg: '#0e8f95' },
  { a: '#fde4f1', b: '#fbc7e1', fg: '#d6338a' },
  { a: '#e8efd6', b: '#d3e2ad', fg: '#5f8a1e' },
];

export function categoryPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTES[hash % PALETTES.length]!;
}

/** Xizmat kartasining rasm o‘rnidagi chiroyli tasviri: kategoriya rangi va ikonasi. Haqiqiy foto yo‘q — shuning uchun yolg‘on rasm ko‘rsatilmaydi. */
export function ServiceArt({ categoryId, categoryName, size = 'card' }: { categoryId: string; categoryName: string; size?: 'card' | 'tile' }) {
  const palette = categoryPalette(categoryId);
  const Icon = categoryIcon(categoryName);
  if (size === 'tile') return <span className="gm-sart gm-sart--tile gm-sart--plain" aria-hidden="true"><span className="gm-sart__icon"><Icon size={20} strokeWidth={1.7} /></span></span>;
  return (
    <span className={`gm-sart gm-sart--${size}`} style={{ background: `linear-gradient(135deg, ${palette.a}, ${palette.b})`, color: palette.fg }} aria-hidden="true">
      <i className="gm-sart__ring gm-sart__ring--1" style={{ borderColor: palette.fg }} />
      <i className="gm-sart__ring gm-sart__ring--2" style={{ borderColor: palette.fg }} />
      <span className="gm-sart__icon"><Icon size={size === 'card' ? 44 : 22} strokeWidth={1.8} /></span>
    </span>
  );
}

/** Xizmat nomi (aniqroq) va kategoriya bo‘yicha foto havolalari (public/services). Mos foto yo‘q bo‘lsa — bo‘sh. */
const PHOTO_RULES: Array<[RegExp, string[]]> = [
  [/massaj/i, ['massage-1', 'massage-2']],
  [/manikyur|pedikyur|qosh|kiprik|makiyaj/i, ['nails-1', 'nails-2']],
  [/soch|soqol|mo.ylov|sartarosh/i, ['hair', 'hair-salon']],
  [/telefon|ekran|batareya/i, ['phone']],
  [/kompyuter|noutbuk|dastur/i, ['computer']],
  [/avto|dvigatel|shina|yurish qismi|evakuator|avtomobil/i, ['car']],
  [/enaga|repetitor|til o.rgat|bola/i, ['kids-books', 'study']],
  [/bo.yoq|suvoq|pardoz/i, ['build-roller', 'build-paint']],
  [/kafel|plitka|laminat|pol |gipso|eshik|deraza|tom /i, ['build-tools', 'build-hammer', 'build-site']],
  [/quvur/i, ['plumb-pipes']],
  [/unitaz|vanna/i, ['plumb-bath']],
  [/kran|santex|armatura/i, ['plumb-faucet', 'plumb-pipes']],
  [/elektr|rozetka|yoritgich|sim/i, ['elec-1', 'elec-2']],
  [/tozalash|tozala|ximchistka|uy tozala/i, ['clean-window', 'clean-vacuum', 'clean-spray']],
  [/oshxona/i, ['home-kitchen']],
  [/mebel|shkaf/i, ['home-living', 'home-dining', 'home-modern']],
  [/muzlatgich|gaz plita|duxovka|kir yuv|changyutgich|televizor|maishiy/i, ['home-appl']],
  [/qurilish|ta.mir/i, ['build-site', 'build-tools']],
  [/dizayn|interyer/i, ['home-modern', 'home-living']],
  [/bog|hovli/i, ['home-exterior', 'home-house']],
];

export function servicePhoto(serviceName: string, categoryName: string, id: string): string | null {
  const rule = PHOTO_RULES.find(([pattern]) => pattern.test(serviceName)) ?? PHOTO_RULES.find(([pattern]) => pattern.test(categoryName));
  if (!rule) return null;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `/services/${rule[1][hash % rule[1].length]}.jpg`;
}

/** Karta fonidagi haqiqiy foto; foto topilmasa yoki yuklanmasa — kategoriya rangidagi tasvirga qaytadi. */
export function ServiceCover({ serviceId, serviceName, categoryId, categoryName }: { serviceId: string; serviceName: string; categoryId: string; categoryName: string }) {
  const [failed, setFailed] = useState(false);
  const src = servicePhoto(serviceName, categoryName, serviceId);
  if (!src || failed) return <ServiceArt categoryId={categoryId} categoryName={categoryName} />;
  return <img className="gm-sphoto" src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
