import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Home, MapPin, Save, Store } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import type { ServiceMode } from '@/features/service/types';
import { useUpdateWorkArea } from '../hooks/useMaster';
import type { MasterProfile } from '../types';
import './ServiceModeEditor.css';
import { t } from '@/i18n';

const OPTIONS: Array<{ mode: ServiceMode; icon: typeof Home; title: () => string; text: () => string }> = [
  { mode: 'AT_CUSTOMER', icon: Home, title: () => t('Mijozning manzilida'), text: () => t('Siz mijozning uyiga yoki ofisiga borasiz (usta, santexnik, uyga chaqirilgan sartarosh).') },
  { mode: 'AT_MASTER', icon: Store, title: () => t('O‘z joyimda'), text: () => t('Mijoz sizning oldingizga keladi (sartaroshxona, ustaxona, avtoservis, salon).') },
];

/**
 * «Ish rejimi»: usta mijozning manzilida, o‘z joyida yoki ikkalasida ham ishlashini tanlaydi.
 * O‘z joyida qabul qilish uchun joy manzili va «Ish hududi»dagi xarita nuqtasi kerak.
 */
export function ServiceModeEditor({ profile }: { profile: MasterProfile }) {
  const update = useUpdateWorkArea();
  const initialModes = profile.serviceModes && profile.serviceModes.length > 0 ? profile.serviceModes : (['AT_CUSTOMER'] as ServiceMode[]);
  const [modes, setModes] = useState<ServiceMode[]>(initialModes);
  const [place, setPlace] = useState(profile.placeAddress ?? '');
  const hasCenter = profile.latitude != null && profile.longitude != null && profile.latitude !== '' && profile.longitude !== '';
  const atMaster = modes.includes('AT_MASTER');
  const placeMissing = atMaster && !place.trim();
  const dirty = modes.slice().sort().join() !== initialModes.slice().sort().join() || place.trim() !== (profile.placeAddress ?? '');
  const canSave = dirty && modes.length > 0 && !placeMissing && (!atMaster || hasCenter) && !update.isPending;

  function toggle(mode: ServiceMode) {
    setModes((current) => (current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode]));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    update.mutate({ serviceModes: modes, placeAddress: atMaster ? place.trim() : '' });
  }

  return (
    <form className="gm-form gm-modeedit" onSubmit={submit}>
      {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
      {update.isSuccess && !dirty && <Alert tone="success">{t('Ish rejimi saqlandi')}</Alert>}

      <div className="gm-modeedit__options" role="group" aria-label={t('Ish rejimi')}>
        {OPTIONS.map((option) => {
          const checked = modes.includes(option.mode);
          return (
            <label key={option.mode} className={cx('gm-modeedit__option', checked && 'gm-modeedit__option--on')}>
              <input type="checkbox" className="gm-visually-hidden" checked={checked} onChange={() => toggle(option.mode)} />
              <option.icon size={22} aria-hidden="true" />
              <span>
                <strong>{option.title()}</strong>
                <small>{option.text()}</small>
              </span>
              <i className="gm-modeedit__check" aria-hidden="true">{checked && <Check size={14} strokeWidth={3} />}</i>
            </label>
          );
        })}
      </div>
      {modes.length === 0 && <p className="gm-modeedit__error" role="alert">{t('Kamida bitta rejimni tanlang.')}</p>}

      {atMaster && (
        <div className="gm-modeedit__place">
          <Input
            label={t('Qabul qilish joyi manzili')}
            required
            maxLength={255}
            placeholder={t('Masalan: Chilonzor, 5-kvartal, “Barber” sartaroshxonasi')}
            hint={t('Mijozlar shu manzilni ko‘radi va shu yerga keladi.')}
            error={placeMissing ? t('Manzilni kiriting.') : undefined}
            value={place}
            onChange={(event) => setPlace(event.target.value)}
          />
          <p className={cx('gm-modeedit__map', !hasCenter && 'gm-modeedit__map--warn')}>
            <MapPin size={16} aria-hidden="true" />{' '}
            {hasCenter ? t('Joylashuv xaritada: «Ish hududi» bo‘limidagi nuqta ishlatiladi.') : t('Avval «Ish hududi» bo‘limida joylashuvingizni xaritada belgilang.')}
          </p>
        </div>
      )}

      <Button type="submit" size="lg" fullWidth loading={update.isPending} disabled={!canSave}>
        <Save size={18} />{' '}{t('Ish rejimini saqlash')}</Button>
    </form>
  );
}
