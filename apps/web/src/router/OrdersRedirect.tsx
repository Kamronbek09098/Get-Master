import { Navigate } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { useCurrentRole } from '@/features/session/hooks/useCurrentRole';

/** Eski «Bronlar» havolalari (/bronlar) endi yagona «Buyurtmalar» bo‘limiga yo‘naltiriladi. */
export function OrdersRedirect() {
  const { role, isLoading } = useCurrentRole();
  if (isLoading) return <PageLoader label="Yuklanmoqda…" />;
  if (role === 'MASTER') return <Navigate to="/usta/buyurtmalar" replace />;
  if (role === 'ADMIN') return <Navigate to="/admin/buyurtmalar" replace />;
  return <Navigate to="/mijoz/buyurtmalar" replace />;
}
