import { Navigate } from 'react-router-dom';
import { env } from '@/lib/env';
import { RedirectIfAuthed } from '@/router/ProtectedRoute';
import { LandingPage } from './landing/LandingPage';
import { PortalPage } from './landing/portal/PortalPage';

/** `/` sahifasi: panel ilovalarida — shu panelning bosh sahifasi; asosiy saytda (rol belgilanmagan) — mijoz/usta tanlanadigan yo‘naltiruvchi sahifa. */
export function RoleSelectPage() {
  if (env.appRole === 'ADMIN') {
    return (
      <RedirectIfAuthed>
        <Navigate to="/login" replace />
      </RedirectIfAuthed>
    );
  }
  if (env.appRole) {
    return (
      <RedirectIfAuthed>
        <LandingPage />
      </RedirectIfAuthed>
    );
  }

  return <PortalPage />;
}
