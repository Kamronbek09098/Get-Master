import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Expand, MapPin, Save } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { AddressPicker } from '@/features/geo/components/AddressPicker';
import type { PickedAddress } from '@/features/geo/components/AddressPicker';
import { CoverageDialog } from '@/features/geo/components/CoverageDialog';
import { CoverageMap } from '@/features/geo/components/CoverageMap';
import { geoService } from '@/features/geo/geo.service';
import { useUpdateWorkArea } from '../hooks/useMaster';
import type { MasterProfile } from '../types';
import { t } from '@/i18n';

const RADIUS_PRESETS = [3, 5, 10, 20, 30, 50];

const num = (value: string | number | null | undefined): number | null => (value === null || value === undefined || value === '' ? null : Number(value));

/**
 * «Ish hududi»: «Ish joyingiz» — oddiy matn (mahalla/tuman nomlari); «Ish hududlari» — manzilni yozib yoki xaritadan tanlash,
 * radius va xaritada ko‘rish bitta kartada. Alohida saqlanadi.
 */
export function WorkAreaEditor({ profile }: { profile: MasterProfile }) {
  const update = useUpdateWorkArea();
  const initial = useMemo(
    () => ({
      latitude: num(profile.latitude),
      longitude: num(profile.longitude),
      // Markaz (manzil) tanlanmagan bo‘lsa, radius ham bo‘sh turadi — o‘zboshimchalik bilan qiymat qo‘yilmaydi.
      radius: profile.workRadiusKm && num(profile.latitude) !== null && num(profile.longitude) !== null ? String(Number(profile.workRadiusKm)) : '',
      workPlace: profile.workPlace ?? '',
    }),
    [profile.latitude, profile.longitude, profile.workRadiusKm, profile.workPlace],
  );

  const [base, setBase] = useState<PickedAddress>({ addressLine: '', city: '', district: '', latitude: initial.latitude, longitude: initial.longitude });
  const [radius, setRadius] = useState(initial.radius);
  const [workPlace, setWorkPlace] = useState(initial.workPlace);
  // Yangi manzil tanlanganda uning tuman/shahar nomlari «ish hududi nomlari» sifatida saqlanadi.
  const [pickedAreas, setPickedAreas] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  // Saqlangan koordinataga mos manzil matnini bir marta tiklaymiz.
  useEffect(() => {
    if (base.latitude == null || base.longitude == null || base.addressLine) return;
    let cancelled = false;
    geoService
      .reverse(base.latitude, base.longitude)
      .then(({ place }) => {
        if (!cancelled && place) setBase((current) => (current.addressLine ? current : { ...current, addressLine: place.addressLine, city: place.city ?? '', district: place.district ?? '' }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const radiusValue = radius ? Number(radius) : null;
  const radiusInvalid = radius !== '' && (!Number.isFinite(radiusValue) || (radiusValue as number) < 0.5 || (radiusValue as number) > 500);
  const centerMissing = radius !== '' && (base.latitude == null || base.longitude == null);
  const dirty =
    base.latitude !== initial.latitude || base.longitude !== initial.longitude || radius !== initial.radius || workPlace.trim() !== initial.workPlace.trim();
  const canSave = dirty && !radiusInvalid && !centerMissing && !update.isPending;

  function pickBase(next: PickedAddress) {
    setBase(next);
    setPickedAreas([next.district, next.city].filter(Boolean));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    update.mutate({
      latitude: base.latitude ?? undefined,
      longitude: base.longitude ?? undefined,
      workRadiusKm: radiusValue ?? undefined,
      workPlace: workPlace.trim(),
      ...(pickedAreas ? { serviceAreas: pickedAreas } : {}),
    });
  }

  return (
    <form className="gm-form gm-workedit" onSubmit={handleSubmit}>
      {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
      {update.isSuccess && !dirty && <Alert tone="success">{t('Ish hududi saqlandi')}</Alert>}

      <section className="gm-workedit__block">
        <span className="gm-workedit__icon" aria-hidden="true">
          <Building2 size={20} />
        </span>
        <h3>{t('Ish joyingiz')}</h3>
        <p className="gm-workarea__note">{t('Ish xona, kompaniya yoki muassasa nomi. Mijozlar profilingizda shuni ko‘radi.')}</p>
        <Input
          label={t('Ish joyi nomi')}
          placeholder={t('Masalan: «Ofis №5» yoki «ABC Servis» MChJ')}
          maxLength={150}
          value={workPlace}
          onChange={(event) => setWorkPlace(event.target.value)}
        />
      </section>

      <section className="gm-workedit__block gm-workedit__block--main">
        <span className="gm-workedit__icon" aria-hidden="true">
          <MapPin size={20} />
        </span>
        <h3>{t('Ish hududlari')}</h3>
        <p className="gm-workarea__note">{t('Manzilni yozing, xaritadan tanlang yoki joriy joylashuvingizni aniqlang — ish radiusi shu nuqtadan hisoblanadi.')}</p>

        <AddressPicker label={t('Ish hududi manzili')} value={base} onChange={pickBase} />

        <div className="gm-workedit__sub">
          <Input
            label={t('Ish radiusi (km)')}
            type="number"
            inputMode="decimal"
            min={0.5}
            max={500}
            step="0.5"
            hint={t('Shu manzildan qancha masofagacha buyurtma olasiz.')}
            error={radiusInvalid ? t('Radius 0,5 dan 500 km gacha bo‘lishi kerak') : centerMissing ? t('Avval ish hududi manzilini tanlang') : undefined}
            value={radius}
            onChange={(event) => setRadius(event.target.value)}
          />
          <div className="gm-workarea__chips" role="group" aria-label={t('Tez tanlash')}>
            {RADIUS_PRESETS.map((km) => (
              <button key={km} type="button" className={radiusValue === km ? 'gm-chip gm-chip--on' : 'gm-chip'} onClick={() => setRadius(String(km))}>
                {km} km
              </button>
            ))}
          </div>
        </div>

        <div className="gm-workedit__sub">
          <span className="gm-workedit__label">{t('Xaritada ko‘rish')}</span>
          <CoverageMap latitude={base.latitude} longitude={base.longitude} radiusKm={radiusValue && !radiusInvalid ? radiusValue : null} height={280} />
          <Button type="button" size="sm" variant="secondary" className="gm-workedit__expand" disabled={base.latitude == null} onClick={() => setOpen(true)}>
            <Expand size={15} />{' '}{t('Katta xaritada ochish')}</Button>
          {base.latitude != null && !radiusValue && <p className="gm-workarea__note">{t('Radiusni kiriting — ishlay oladigan hudud xaritada doira bo‘lib ko‘rinadi.')}</p>}
        </div>
      </section>

      <Button type="submit" size="lg" fullWidth loading={update.isPending} disabled={!canSave}>
        <Save size={18} />{' '}{t('Ish hududini saqlash')}</Button>

      <CoverageDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('Ish hududim')}
        area={null}
        areas={pickedAreas ?? profile.serviceAreas ?? []}
        lat={base.latitude}
        lon={base.longitude}
        radiusKm={radiusValue && !radiusInvalid ? radiusValue : null}
      />
    </form>
  );
}
