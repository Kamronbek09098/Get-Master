import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { AddressPicker } from '@/features/geo/components/AddressPicker';
import type { PickedAddress } from '@/features/geo/components/AddressPicker';
import { CoverageMap } from '@/features/geo/components/CoverageMap';
import { geoService } from '@/features/geo/geo.service';
import { useMe } from '@/features/session/hooks/useMe';
import { useSaveMasterProfile } from '../hooks/useMaster';
import type { MasterProfile } from '../types';

export function MasterForm({ profile }: { profile: MasterProfile | null }) {
  const saveProfile = useSaveMasterProfile(profile === null);
  const me = useMe();
  const [firstName, setFirstName] = useState(me.data?.firstName ?? '');
  const [lastName, setLastName] = useState(me.data?.lastName ?? '');
  const [profession, setProfession] = useState(profile?.profession ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [workRadius, setWorkRadius] = useState(profile?.workRadiusKm ? String(Number(profile.workRadiusKm)) : '');
  const [areas, setAreas] = useState((profile?.serviceAreas ?? []).join(', '));
  const [experienceYears, setExperienceYears] = useState(profile?.experienceYears ? String(profile.experienceYears) : '');

  const [base, setBase] = useState<PickedAddress>({
    addressLine: '',
    city: '',
    district: '',
    latitude: profile?.latitude != null ? Number(profile.latitude) : null,
    longitude: profile?.longitude != null ? Number(profile.longitude) : null,
  });

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

  // Tanlangan joydan tuman/shahar nomlarini hududlar ro‘yxatiga qo‘shamiz.
  function pickBase(next: PickedAddress) {
    setBase(next);
    const names = [next.district, next.city].filter(Boolean);
    if (names.length === 0) return;
    const current = areas.split(',').map((item) => item.trim()).filter(Boolean);
    const merged = [...current, ...names.filter((name) => !current.includes(name))];
    setAreas(merged.join(', '));
  }

  const radiusValue = workRadius ? Number(workRadius) : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    saveProfile.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      profession: profession.trim(),
      bio: bio.trim() || undefined,
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
      workRadiusKm: workRadius ? Number(workRadius) : undefined,
      latitude: base.latitude ?? undefined,
      longitude: base.longitude ?? undefined,
      serviceAreas: areas
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20),
    });
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {saveProfile.isError && <Alert tone="danger">{getErrorMessage(saveProfile.error)}</Alert>}
      {saveProfile.isSuccess && <Alert tone="success">Profil saqlandi</Alert>}
      <Input label="Ism" required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
      <Input label="Familiya" required maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} />
      <Input label="Kasb" required value={profession} onChange={(event) => setProfession(event.target.value)} />
      <Input
        label="Tajriba (yil)"
        type="number"
        min={0}
        max={80}
        value={experienceYears}
        onChange={(event) => setExperienceYears(event.target.value)}
      />
      <div className="gm-workarea">
        <h3 className="gm-workarea__title">Ish joyi va hududi</h3>
        <AddressPicker label="Ish joyingiz (markaz)" value={base} onChange={pickBase} />
        <Input
          label="Ish radiusi (km)"
          type="number"
          inputMode="decimal"
          min={0.5}
          max={500}
          step="0.5"
          hint="Shu manzildan qancha masofagacha buyurtma olasiz."
          value={workRadius}
          onChange={(event) => setWorkRadius(event.target.value)}
        />
        <div className="gm-workarea__chips" role="group" aria-label="Tez tanlash">
          {[3, 5, 10, 20, 30, 50].map((km) => (
            <button key={km} type="button" className={radiusValue === km ? 'gm-chip gm-chip--on' : 'gm-chip'} onClick={() => setWorkRadius(String(km))}>
              {km} km
            </button>
          ))}
        </div>
        <CoverageMap latitude={base.latitude} longitude={base.longitude} radiusKm={radiusValue} />
        {base.latitude != null && !radiusValue && <p className="gm-workarea__note">Radiusni kiriting — ishlay oladigan hudud xaritada doira bo‘lib ko‘rinadi.</p>}
      </div>
      <Input label="Ish hududlari (vergul bilan)" placeholder="Chilonzor, Yunusobod" value={areas} onChange={(event) => setAreas(event.target.value)} />
      <Textarea label="O‘zingiz haqingizda" value={bio} onChange={(event) => setBio(event.target.value)} rows={4} />
      <Button type="submit" size="lg" fullWidth loading={saveProfile.isPending} disabled={!profession.trim() || !firstName.trim() || !lastName.trim()}>
        {profile ? 'Saqlash' : 'Usta profilini yaratish'}
      </Button>
    </form>
  );
}
