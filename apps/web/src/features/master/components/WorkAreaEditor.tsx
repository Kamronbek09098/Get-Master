import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Expand, MapPin, Plus, Save, X } from 'lucide-react';
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

const MAX_AREAS = 20;
const RADIUS_PRESETS = [3, 5, 10, 20, 30, 50];

const num = (value: string | number | null | undefined): number | null => (value === null || value === undefined || value === '' ? null : Number(value));

/**
 * «Ish hududi» — bitta joyda barcha imkoniyatlar: ish markazi (manzil qidirish, xaritadan tanlash, joriy joylashuv),
 * radius, xaritada ko‘rish va hudud nomlari. Alohida saqlanadi.
 */
export function WorkAreaEditor({ profile }: { profile: MasterProfile }) {
  const update = useUpdateWorkArea();
  const initial = useMemo(
    () => ({
      latitude: num(profile.latitude),
      longitude: num(profile.longitude),
      radius: profile.workRadiusKm ? String(Number(profile.workRadiusKm)) : '',
      areas: profile.serviceAreas ?? [],
    }),
    [profile.latitude, profile.longitude, profile.workRadiusKm, profile.serviceAreas],
  );

  const [base, setBase] = useState<PickedAddress>({ addressLine: '', city: '', district: '', latitude: initial.latitude, longitude: initial.longitude });
  const [radius, setRadius] = useState(initial.radius);
  const [areas, setAreas] = useState<string[]>(initial.areas);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState<string | null>(null);

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
    base.latitude !== initial.latitude ||
    base.longitude !== initial.longitude ||
    radius !== initial.radius ||
    areas.length !== initial.areas.length ||
    areas.some((area, index) => area !== initial.areas[index]);
  const canSave = dirty && !radiusInvalid && !centerMissing && !update.isPending;

  function addArea(raw: string) {
    const name = raw.trim().slice(0, 100);
    if (!name || areas.length >= MAX_AREAS || areas.some((area) => area.toLowerCase() === name.toLowerCase())) return;
    setAreas((current) => [...current, name]);
  }

  // Tanlangan joydan tuman/shahar nomlarini hududlar ro‘yxatiga qo‘shamiz.
  function pickBase(next: PickedAddress) {
    setBase(next);
    [next.district, next.city].filter(Boolean).forEach((name) => addArea(name));
  }

  function onDraftKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addArea(draft);
      setDraft('');
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    update.mutate({
      latitude: base.latitude ?? undefined,
      longitude: base.longitude ?? undefined,
      workRadiusKm: radiusValue ?? undefined,
      serviceAreas: areas,
    });
  }

  return (
    <form className="gm-form gm-workedit" onSubmit={handleSubmit}>
      {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
      {update.isSuccess && !dirty && <Alert tone="success">Ish hududi saqlandi</Alert>}

      <section className="gm-workedit__block">
        <h3>1. Ish joyingiz (markaz)</h3>
        <AddressPicker label="Manzil" value={base} onChange={pickBase} />
      </section>

      <section className="gm-workedit__block">
        <h3>2. Ish radiusi</h3>
        <Input
          label="Radius (km)"
          type="number"
          inputMode="decimal"
          min={0.5}
          max={500}
          step="0.5"
          hint="Shu manzildan qancha masofagacha buyurtma olasiz."
          error={radiusInvalid ? 'Radius 0,5 dan 500 km gacha bo‘lishi kerak' : centerMissing ? 'Avval ish joyingizni (markazni) tanlang' : undefined}
          value={radius}
          onChange={(event) => setRadius(event.target.value)}
        />
        <div className="gm-workarea__chips" role="group" aria-label="Tez tanlash">
          {RADIUS_PRESETS.map((km) => (
            <button key={km} type="button" className={radiusValue === km ? 'gm-chip gm-chip--on' : 'gm-chip'} onClick={() => setRadius(String(km))}>
              {km} km
            </button>
          ))}
        </div>
      </section>

      <section className="gm-workedit__block">
        <h3>3. Xaritada ko‘rish</h3>
        <CoverageMap latitude={base.latitude} longitude={base.longitude} radiusKm={radiusValue && !radiusInvalid ? radiusValue : null} height={280} />
        <Button type="button" size="sm" variant="secondary" className="gm-workedit__expand" disabled={base.latitude == null} onClick={() => setOpen('')}>
          <Expand size={15} /> Katta xaritada ochish
        </Button>
        {base.latitude != null && !radiusValue && <p className="gm-workarea__note">Radiusni kiriting — ishlay oladigan hudud xaritada doira bo‘lib ko‘rinadi.</p>}
      </section>

      <section className="gm-workedit__block">
        <h3>4. Ish hududlari</h3>
        <p className="gm-workarea__note">Mahalla yoki tuman nomlari — mijozlar shu bo‘yicha ham topadi. Tanlangan joydan nomlar o‘zi qo‘shiladi.</p>
        {areas.length > 0 ? (
          <ul className="gm-ptags gm-workedit__tags" aria-label="Ish hududlari">
            {areas.map((area) => (
              <li key={area}>
                <button type="button" className="gm-ptags__btn" onClick={() => setOpen(area)} aria-label={`${area} — xaritada ochish`}>
                  <MapPin size={13} aria-hidden="true" /> {area}
                </button>
                <button type="button" className="gm-workedit__remove" onClick={() => setAreas((current) => current.filter((item) => item !== area))} aria-label={`${area} ni olib tashlash`}>
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="gm-pempty">Hududlar kiritilmagan.</p>
        )}
        <div className="gm-workedit__add">
          <Input label="Hudud qo‘shish" placeholder="Masalan: Chilonzor" maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onDraftKey} disabled={areas.length >= MAX_AREAS} />
          <Button
            type="button"
            variant="secondary"
            className="gm-workedit__addbtn"
            disabled={!draft.trim() || areas.length >= MAX_AREAS}
            onClick={() => {
              addArea(draft);
              setDraft('');
            }}
          >
            <Plus size={16} /> Qo‘shish
          </Button>
        </div>
      </section>

      <Button type="submit" size="lg" fullWidth loading={update.isPending} disabled={!canSave}>
        <Save size={18} /> Ish hududini saqlash
      </Button>

      <CoverageDialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title="Ish hududim"
        area={open || null}
        areas={areas}
        lat={base.latitude}
        lon={base.longitude}
        radiusKm={radiusValue && !radiusInvalid ? radiusValue : null}
      />
    </form>
  );
}
