import { lazy } from 'react';
import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router-dom';
import { getNavItems } from '@/components/layout/nav-items';
import { RouteError } from '@/components/common/RouteError';
import { RootShell } from './RootShell';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute, RedirectIfAuthed } from './ProtectedRoute';
import { OrdersRedirect } from './OrdersRedirect';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RoleGuard } from './RoleGuard';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import type { ReactNode } from 'react';
import type { Role } from '@/types/common';
import { RoleSelectPage } from '@/pages/RoleSelectPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { OtpPage } from '@/pages/auth/OtpPage';
import { CustomerOrdersPage } from '@/pages/orders/CustomerOrdersPage';
import { CreateRequestPage } from '@/pages/requests/CreateRequestPage';
import { RequestDetailsPage } from '@/pages/requests/RequestDetailsPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { OrderDetailsPage } from '@/pages/orders/OrderDetailsPage';
import { CreateOfferPage } from '@/pages/offers/CreateOfferPage';
import { PaymentPage } from '@/pages/payments/PaymentPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CustomerPage } from '@/pages/customer/CustomerPage';
import { CustomerProfilePage } from '@/pages/customer/CustomerProfilePage';
import { MasterPage } from '@/pages/master/MasterPage';
import { MasterProfilePage } from '@/pages/master/MasterProfilePage';
import { SubscriptionPage } from '@/pages/subscription/SubscriptionPage';
import { MasterDetailsPage } from '@/pages/master/MasterDetailsPage';
import { CustomerPublicPage } from '@/pages/customer/CustomerPublicPage';
import { DisputesPage } from '@/pages/disputes/DisputesPage';
import { ComplaintsPage } from '@/pages/complaints/ComplaintsPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { ChatPage } from '@/pages/chat/ChatPage';
import { WarrantyPage } from '@/pages/warranty/WarrantyPage';
import { ActiveOffersPage } from '@/pages/offers/ActiveOffersPage';
import { MyOffersPage } from '@/pages/offers/MyOffersPage';
import { MasterSchedulePage } from '@/pages/master/MasterSchedulePage';
import { MasterPortfolioPage } from '@/pages/master/MasterPortfolioPage';
import { EarningsPage } from '@/pages/payments/EarningsPage';
import { PaymentHistoryPage } from '@/pages/payments/PaymentHistoryPage';
import { TermsPage } from '@/pages/legal/TermsPage';
import { SafetyPage } from '@/pages/safety/SafetyPage';

const AdminHome = lazy(() => import('@/pages/admin/AdminHome').then((m) => ({ default: m.AdminHome })));
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminAdminsPage = lazy(() => import('@/pages/admin/AdminAdminsPage').then((m) => ({ default: m.AdminAdminsPage })));
const AdminUserProfilePage = lazy(() => import('@/pages/admin/AdminUserProfilePage').then((m) => ({ default: m.AdminUserProfilePage })));
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })));
const AdminOrderDetailPage = lazy(() => import('@/pages/admin/AdminOrderDetailPage').then((m) => ({ default: m.AdminOrderDetailPage })));
const AdminVerificationsPage = lazy(() => import('@/pages/admin/AdminVerificationsPage').then((m) => ({ default: m.AdminVerificationsPage })));
const AdminCasesPage = lazy(() => import('@/pages/admin/AdminCasesPage').then((m) => ({ default: m.AdminCasesPage })));
const AdminSafetyPage = lazy(() => import('@/pages/admin/AdminSafetyPage').then((m) => ({ default: m.AdminSafetyPage })));
const AdminCatalogPage = lazy(() => import('@/pages/admin/AdminCatalogPage').then((m) => ({ default: m.AdminCatalogPage })));
const AdminPoliciesPage = lazy(() => import('@/pages/admin/AdminPoliciesPage').then((m) => ({ default: m.AdminPoliciesPage })));
const AdminAuditPage = lazy(() => import('@/pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminSubscriptionsPage = lazy(() => import('@/pages/admin/AdminSubscriptionsPage').then((m) => ({ default: m.AdminSubscriptionsPage })));
const AdminErrorsPage = lazy(() => import('@/pages/admin/AdminErrorsPage').then((m) => ({ default: m.AdminErrorsPage })));
const AdminDevOpsPage = lazy(() => import('@/pages/admin/AdminDevOpsPage').then((m) => ({ default: m.AdminDevOpsPage })));
const AdminChatsPage = lazy(() => import('@/pages/admin/AdminChatsPage').then((m) => ({ default: m.AdminChatsPage })));



const only = (roles: Role[], element: ReactNode) => <RoleGuard roles={roles}>{element}</RoleGuard>;
const customer = (el: ReactNode) => only(['CUSTOMER'], el);
const master = (el: ReactNode) => only(['MASTER'], el);
const admin = (el: ReactNode) => only(['ADMIN'], el);
const shared = (el: ReactNode) => only(['CUSTOMER', 'MASTER'], el);


/** Eski manzillar (/mijozlar/…, /ustalar/…, /ustalar-katalogi/…) yangi (/mijoz/…, /usta/…) manzillarga o‘tkaziladi. */
function LegacyRedirect({ to }: { to: string }) {
  const { '*': rest = '' } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${rest ? `/${rest}` : ''}${search}${hash}`} replace />;
}

/**
 * getmaster.uz/mijoz va getmaster.uz/usta: kirmagan foydalanuvchiga shu panelning bosh sahifasi (landing) ko‘rsatiladi —
 * u yerdan «Kirish» / «Ro‘yxatdan o‘tish» qilinadi. Kirgan bo‘lsa, shu paneldagi birinchi bo‘limga o‘tadi.
 */
function PanelHome({ role }: { role: Role }) {
  const hasSession = useAuthStore((s) => s.hasSession);
  if (!hasSession) return <RoleSelectPage />;
  const [first] = getNavItems(role, { superAdmin: false });
  return <Navigate to={first?.to ?? '/'} replace />;
}

const panelRouter = createBrowserRouter([
  {
    element: <RootShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <RoleSelectPage /> },
      { path: '/mijoz', element: <PanelHome role="CUSTOMER" /> },
      { path: '/usta', element: <PanelHome role="MASTER" /> },
      { path: '/shartlar', element: <TermsPage /> },
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/login',
            element: (
              <RedirectIfAuthed>
                <LoginPage />
              </RedirectIfAuthed>
            ),
          },
          {
            path: '/register',
            element: (
              <RedirectIfAuthed>
                <RegisterPage />
              </RedirectIfAuthed>
            ),
          },
          { path: '/otp', element: <OtpPage /> },
        ],
      },
      {
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/mijoz/sorovlar', element: <Navigate to="/mijoz/buyurtmalar" replace /> },
          { path: '/mijoz/sorov-yaratish', element: customer(<CreateRequestPage />) },
          { path: '/mijoz/sorovlar/:id', element: customer(<RequestDetailsPage />) },
          { path: '/mijoz/buyurtmalar', element: customer(<CustomerOrdersPage />) },
          { path: '/mijoz/buyurtmalar/:id', element: customer(<OrderDetailsPage />) },
          { path: '/mijoz/buyurtmalar/:orderId/tolov', element: customer(<PaymentPage />) },
          { path: '/usta/buyurtmalar', element: master(<OrdersPage />) },
          { path: '/usta/buyurtmalar/:id', element: master(<OrderDetailsPage />) },
          { path: '/usta/takliflar', element: master(<CreateOfferPage />) },
          { path: '/mijoz/profil', element: customer(<CustomerProfilePage />) },
          { path: '/mijoz/profil/:section', element: customer(<CustomerProfilePage />) },
          { path: '/mijoz/manzillar', element: customer(<CustomerPage />) },
          { path: '/mijoz/chat', element: customer(<ChatPage />) },
          { path: '/mijoz/kafolat', element: customer(<WarrantyPage />) },
          { path: '/mijoz/shikoyatlar', element: customer(<ComplaintsPage />) },
          { path: '/mijoz/nizolar', element: customer(<DisputesPage />) },
          { path: '/usta/profil', element: master(<MasterProfilePage />) },
          { path: '/usta/profil/:section', element: master(<MasterProfilePage />) },
          { path: '/usta/chat', element: master(<ChatPage />) },
          { path: '/usta/obuna', element: master(<SubscriptionPage />) },
          { path: '/mijoz/obuna', element: customer(<SubscriptionPage />) },
          { path: '/usta/mijozlar/:id', element: master(<CustomerPublicPage />) },
          { path: '/usta/kafolat', element: master(<WarrantyPage />) },
          { path: '/usta/nizolar', element: master(<DisputesPage />) },
          { path: '/mijoz/ustalar', element: customer(<MasterPage />) },
          { path: '/mijoz/ustalar/:id', element: customer(<MasterDetailsPage />) },
          { path: '/bronlar', element: shared(<OrdersRedirect />) },
          { path: '/bronlar/:id', element: shared(<OrdersRedirect />) },
          { path: '/mijoz/tolovlar', element: customer(<PaymentHistoryPage />) },
          { path: '/usta/faol-takliflar', element: master(<ActiveOffersPage />) },
          { path: '/usta/mening-takliflarim', element: master(<MyOffersPage />) },
          { path: '/usta/jadval', element: master(<MasterSchedulePage />) },
          { path: '/usta/portfolio', element: master(<MasterPortfolioPage />) },
          { path: '/usta/daromad', element: master(<EarningsPage />) },
          { path: '/huquqiy', element: <Navigate to="/sozlamalar" replace /> },
          { path: '/xavfsizlik', element: shared(<SafetyPage />) },
          { path: '/admin', element: admin(<AdminHome />) },
          { path: '/admin/hisobot', element: admin(<AdminReportsPage />) },
          { path: '/admin/foydalanuvchilar', element: admin(<AdminUsersPage />) },
          { path: '/admin/adminlar', element: admin(<AdminAdminsPage />) },
          { path: '/admin/foydalanuvchilar/:id', element: admin(<AdminUserProfilePage />) },
          { path: '/admin/buyurtmalar', element: admin(<AdminOrdersPage />) },
          { path: '/admin/buyurtmalar/:id', element: admin(<AdminOrderDetailPage />) },
          { path: '/admin/mijozlar', element: <Navigate to="/admin/foydalanuvchilar" replace /> },
          { path: '/admin/tasdiqlash', element: admin(<AdminVerificationsPage />) },
          { path: '/admin/shikoyatlar', element: admin(<AdminCasesPage />) },
          { path: '/admin/xavfsizlik', element: admin(<AdminSafetyPage />) },
          { path: '/admin/katalog', element: admin(<AdminCatalogPage />) },
          { path: '/admin/siyosatlar', element: admin(<AdminPoliciesPage />) },
          { path: '/admin/audit', element: admin(<AdminAuditPage />) },
          { path: '/admin/errorlar', element: admin(<AdminErrorsPage />) },
          { path: '/admin/obunalar', element: admin(<AdminSubscriptionsPage />) },
          { path: '/admin/devops', element: admin(<AdminDevOpsPage />) },
          { path: '/admin/suhbatlar', element: admin(<AdminChatsPage />) },
          { path: '/admin/xabarlar', element: admin(<ChatPage />) },
          { path: '/bildirishnomalar', element: <NotificationsPage /> },
          { path: '/sozlamalar', element: <SettingsPage /> },
          { path: '/sozlamalar/:section', element: <SettingsPage /> },
        ],
      },
      { path: '/mijozlar/*', element: <LegacyRedirect to="/mijoz" /> },
      { path: '/ustalar/*', element: <LegacyRedirect to="/usta" /> },
      { path: '/ustalar-katalogi/*', element: <LegacyRedirect to="/mijoz/ustalar" /> },
      { path: '/ustalar-katalogi', element: <Navigate to="/mijoz/ustalar" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

/**
 * Asosiy sayt (getmaster.uz, rol belgilanmagan): faqat yo‘naltirish sahifasi. Kirish va ro‘yxatdan o‘tish — har bir panelning o‘zida (mijoz / usta / admin alohida).
 */
const portalRouter = createBrowserRouter([
  {
    element: <RootShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <RoleSelectPage /> },
      { path: '/shartlar', element: <TermsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export const router = env.appRole ? panelRouter : portalRouter;
