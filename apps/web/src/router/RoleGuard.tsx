import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { getNavItems } from '@/components/layout/nav-items';
import { useCurrentRole } from '@/features/session/hooks/useCurrentRole';
import type { Role } from '@/types/common';

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role, isLoading, isError, needsMasterOnboarding } = useCurrentRole();
  const { pathname } = useLocation();

  if (isLoading) return <PageLoader label="Yuklanmoqda…" />;
  if (isError || !role) return <Navigate to="/login" replace />;
  if (needsMasterOnboarding && roles.includes('MASTER') && !roles.includes('CUSTOMER') && pathname !== '/ustalar/profil') {
    return <Navigate to="/ustalar/profil" replace />;
  }
  if (!roles.includes(role)) {
    const [first] = getNavItems(role);
    return <Navigate to={first?.to ?? '/'} replace />;
  }
  return children;
}
