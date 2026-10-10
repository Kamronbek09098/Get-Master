import { MapPin } from 'lucide-react';
import { cx } from '@/lib/utils';
import { usePublicRegions } from './hooks';
import './RegionSelect.css';
import { t } from '@/i18n';

/** Hudud tanlash (14 hudud, har birida nechta usta borligi bilan): butun O‘zbekiston bo‘yicha qidirish. */
export function RegionSelect({ value, onChange, className, allLabel }: { value: string; onChange: (region: string) => void; className?: string; allLabel?: string }) {
  const regions = usePublicRegions();
  return (
    <label className={cx('gm-region', className)}>
      <MapPin size={17} aria-hidden="true" />
      <span className="gm-visually-hidden">{t('Hudud')}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={t('Hudud')}>
        <option value="">{allLabel ?? t('Butun O‘zbekiston')}</option>
        {(regions.data ?? []).map((region) => (
          <option key={region.key} value={region.key}>{region.masters > 0 ? `${region.name} (${region.masters})` : region.name}</option>
        ))}
      </select>
    </label>
  );
}
