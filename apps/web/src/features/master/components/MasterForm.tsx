import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    saveProfile.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      profession: profession.trim(),
      bio: bio.trim() || undefined,
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
      workRadiusKm: workRadius ? Number(workRadius) : undefined,
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
      <Input
        label="Ish radiusi (km)"
        type="number"
        min={0.5}
        max={500}
        step="0.5"
        value={workRadius}
        onChange={(event) => setWorkRadius(event.target.value)}
      />
      <Input label="Ish hududlari (vergul bilan)" placeholder="Chilonzor, Yunusobod" value={areas} onChange={(event) => setAreas(event.target.value)} />
      <Textarea label="O‘zingiz haqingizda" value={bio} onChange={(event) => setBio(event.target.value)} rows={4} />
      <Button type="submit" loading={saveProfile.isPending} disabled={!profession.trim() || !firstName.trim() || !lastName.trim()}>
        {profile ? 'Saqlash' : 'Usta profilini yaratish'}
      </Button>
    </form>
  );
}
