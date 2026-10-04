import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Languages, LogOut, MonitorSmartphone, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DeviceList } from '@/features/auth/components/DeviceList';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { GoogleLinkSettings } from '@/features/session/components/GoogleLinkSettings';
import { TwoFactorSettings } from '@/features/session/components/TwoFactorSettings';
import { LanguageSettings } from '@/features/session/components/LanguageSettings';
import { ProfileMenuList, ProfileSubPage } from '@/features/profile/ProfileMenu';
import { LANGUAGES, lang } from '@/i18n';
import { UI_SIZES, getUiSize, setUiSize, type UiSize } from '@/lib/ui-size';
import '@/features/profile/Profile.css';
import './SettingsPage.css';
import { t } from '@/i18n';

const BASE = '/sozlamalar';

/** Sozlamalar: profil kabi — asosiy sahifada menyu, har bir qator alohida ichki bo‘lim. */
export function SettingsPage() {
  const { section } = useParams();
  const [size, setSize] = useState<UiSize>(getUiSize);
  const logout = useLogout();

  function choose(next: UiSize) {
    setSize(next);
    setUiSize(next);
  }

  if (section === 'korinish') {
    return (
      <ProfileSubPage title={t('Tugmalar o‘lchami')} backTo={BASE}>
        <div className="gm-size-picker" role="radiogroup" aria-label={t('Tugmalar o‘lchami')}>
          {UI_SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={size === option.value}
              className={size === option.value ? 'gm-size-picker__item gm-size-picker__item--active' : 'gm-size-picker__item'}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="gm-size-preview">
          <Button size="sm">{t('Kichik tugma')}</Button>
          <Button>{t('O‘rtacha tugma')}</Button>
          <Button size="lg">{t('Katta tugma')}</Button>
        </div>
      </ProfileSubPage>
    );
  }
  if (section === 'til') {
    return (
      <ProfileSubPage title={t('Til')} backTo={BASE}>
        <LanguageSettings />
      </ProfileSubPage>
    );
  }
  if (section === 'xavfsizlik') {
    return (
      <ProfileSubPage title={t('Ikki bosqichli himoya')} backTo={BASE}>
        <TwoFactorSettings />
      </ProfileSubPage>
    );
  }
  if (section === 'google') {
    return (
      <ProfileSubPage title={t('Google akkaunt')} backTo={BASE}>
        <GoogleLinkSettings />
      </ProfileSubPage>
    );
  }
  if (section === 'qurilmalar') {
    return (
      <ProfileSubPage title={t('Faol qurilmalar')} backTo={BASE}>
        <DeviceList />
      </ProfileSubPage>
    );
  }
  if (section) return <Navigate to={BASE} replace />;

  return (
    <div className="gm-pmenu-page">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <h1>{t('Sozlamalar')}</h1>
      </div>
      <ProfileMenuList
        rows={[
          { key: 'lang', icon: Languages, label: t('Til'), value: LANGUAGES.find((item) => item.code === lang)?.label, to: `${BASE}/til` },
          { key: 'view', icon: SlidersHorizontal, label: t('Tugmalar o‘lchami'), value: UI_SIZES.find((item) => item.value === size)?.label, to: `${BASE}/korinish` },
          { key: 'security', icon: ShieldCheck, label: t('Ikki bosqichli himoya'), to: `${BASE}/xavfsizlik` },
          { key: 'google', icon: UserRound, label: t('Google akkaunt'), to: `${BASE}/google` },
          { key: 'devices', icon: MonitorSmartphone, label: t('Faol qurilmalar'), to: `${BASE}/qurilmalar` },
          { key: 'logout', icon: LogOut, label: t('Tizimdan chiqish'), danger: true, onClick: () => logout.mutate(false) },
        ]}
      />
    </div>
  );
}
