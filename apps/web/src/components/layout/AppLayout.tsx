import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';
import { Footer } from './Footer';
import { useCurrentRole } from '@/features/session/hooks/useCurrentRole';
import { useAutoReadNotifications } from '@/features/notification/hooks/useAutoReadNotifications';
import { VerificationBanner } from '@/features/trust/components/VerificationBanner';
import { NameRequiredDialog } from '@/features/session/components/NameRequiredDialog';
import './AppLayout.css';

export function AppLayout() {
  const { role, needsMasterOnboarding } = useCurrentRole();
  useAutoReadNotifications();
  return (
    <div className="gm-app-layout">
      <a href="#gm-main-content" className="gm-skip-link">
        Asosiy kontentga o‘tish
      </a>
      <Header />
      <div className="gm-app-layout__body">
        <Sidebar />
        <main id="gm-main-content" className="gm-app-layout__content">
          {role === 'MASTER' && !needsMasterOnboarding && <VerificationBanner />}
          <Outlet />
        </main>
      </div>
      <MobileNavigation />
      <NameRequiredDialog />
      <Footer />
    </div>
  );
}
