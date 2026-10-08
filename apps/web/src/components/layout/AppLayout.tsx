import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';
import { Footer } from './Footer';
import { useCurrentRole } from '@/features/session/hooks/useCurrentRole';
import { useAutoReadNotifications } from '@/features/notification/hooks/useAutoReadNotifications';
import { Alert } from '@/components/ui/Alert';
import { VerificationBanner } from '@/features/trust/components/VerificationBanner';
import { PhoneRequiredBanner } from '@/features/session/components/PhoneRequiredBanner';
import { NameRequiredDialog } from '@/features/session/components/NameRequiredDialog';
import { CallProvider } from '@/features/call/CallProvider';
import { usePushNotifications } from '@/features/push/usePushNotifications';
import { WebPushPrompt } from '@/features/push/WebPushPrompt';
import { t } from '@/i18n';
import './AppLayout.css';

export function AppLayout() {
  const { role, needsMasterOnboarding } = useCurrentRole();
  useAutoReadNotifications();
  // Telefon ilovasida push yoqiladi (mijoz, usta va admin).
  usePushNotifications(role === 'CUSTOMER' || role === 'MASTER' || role === 'ADMIN');
  return (
    <CallProvider>
    <div className="gm-app-layout">
      <a href="#gm-main-content" className="gm-skip-link">
        {t('Asosiy kontentga o‘tish')}
      </a>
      <Header />
      <div className="gm-app-layout__body">
        <Sidebar />
        <main id="gm-main-content" className="gm-app-layout__content">
          <WebPushPrompt />
          {role === 'MASTER' && !needsMasterOnboarding && <VerificationBanner />}
          {role === 'MASTER' && needsMasterOnboarding && (
            <Alert tone="info" title={t('Avval usta profilini yarating')}>
              {t('Takliflar, buyurtmalar, portfolio va boshqa bo‘limlar profil yaratilgach ochiladi. Quyidagi shaklda kasbingizni kiriting va «Usta profilini yaratish» tugmasini bosing.')}
            </Alert>
          )}
          {role === 'CUSTOMER' && <PhoneRequiredBanner />}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <MobileNavigation />
      <NameRequiredDialog />
      <Footer />
    </div>
    </CallProvider>
  );
}
