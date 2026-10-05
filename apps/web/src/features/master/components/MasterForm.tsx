import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { joinFullName, splitFullName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { useMe } from '@/features/session/hooks/useMe';
import { useSaveMasterProfile } from '../hooks/useMaster';
import type { MasterProfile } from '../types';
import { t } from '@/i18n';

export function MasterForm({ profile }: { profile: MasterProfile | null }) {
  const saveProfile = useSaveMasterProfile(profile === null);
  const me = useMe();
  const [fullName, setFullName] = useState(joinFullName(me.data?.firstName, me.data?.lastName));
  const names = splitFullName(fullName);
  const [profession, setProfession] = useState(profile?.profession ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [experienceYears, setExperienceYears] = useState(profile?.experienceYears ? String(profile.experienceYears) : '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    saveProfile.mutate({
      ...(names ?? {}),
      profession: profession.trim(),
      bio: bio.trim() || undefined,
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
    });
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {saveProfile.isError && <Alert tone="danger">{getErrorMessage(saveProfile.error)}</Alert>}
      {saveProfile.isSuccess && <Alert tone="success">{t('Profil saqlandi')}</Alert>}
      <div style={{ gridColumn: '1 / -1' }}>
        <Input label={t('To‘liq ism')} placeholder={t('Masalan: Kamronbek Ziyovuddinov')} autoComplete="name" required maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} hint={fullName.trim() && !names ? t('Ism va familiyani birga yozing') : undefined} />
      </div>
      <Input label={t('Kasb')} required maxLength={150} value={profession} onChange={(event) => setProfession(event.target.value)} />
      <Input
        label={t('Tajriba (yil)')}
        type="number"
        min={0}
        max={70}
        value={experienceYears}
        onChange={(event) => {
          // Faqat butun son, 0–70 (server chegarasi bilan bir xil): undan katta yozib bo‘lmaydi.
          const digits = event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
          setExperienceYears(digits === '' ? '' : String(Math.min(70, Number(digits))));
        }}
      />
      <Textarea label={t('O‘zingiz haqingizda')} maxLength={2000} value={bio} onChange={(event) => setBio(event.target.value)} rows={4} />
      <Button type="submit" size="lg" fullWidth loading={saveProfile.isPending} disabled={!profession.trim() || !names}>
        {profile ? t('Saqlash') : t('Usta profilini yaratish')}
      </Button>
    </form>
  );
}
