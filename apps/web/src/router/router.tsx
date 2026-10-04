import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootShell } from './RootShell';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute, RedirectIfAuthed } from './ProtectedRoute';
import { OrdersRedirect } from './OrdersRedirect';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RoleGuard } from './RoleGuard';
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
import { MasterDetailsPage } from '@/pages/master/MasterDetailsPage';
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
import { LegalPage } from '@/pages/legal/LegalPage';
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
const AdminDevOpsPage = lazy(() => import('@/pages/admin/AdminDevOpsPage').then((m) => ({ default: m.AdminDevOpsPage })));
const AdminChatsPage = lazy(() => import('@/pages/admin/AdminChatsPage').then((m) => ({ default: m.AdminChatsPage })));



const only = (roles: Role[], element: ReactNode) => <RoleGuard roles={roles}>{element}</RoleGuard>;
const customer = (el: ReactNode) => only(['CUSTOMER'], el);
const master = (el: ReactNode) => only(['MASTER'], el);
const admin = (el: ReactNode) => only(['ADMIN'], el);
const shared = (el: ReactNode) => only(['CUSTOMER', 'MASTER'], el);


export const router = createBrowserRouter([
  {
    element: <RootShell />,
    children: [
      { path: '/', element: <RoleSelectPage /> },
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
          { path: '/mijozlar/sorovlar', element: <Navigate to="/mijozlar/buyurtmalar" replace /> },
          { path: '/mijozlar/sorov-yaratish', element: customer(<CreateRequestPage />) },
          { path: '/mijozlar/sorovlar/:id', element: customer(<RequestDetailsPage />) },
          { path: '/mijozlar/buyurtmalar', element: customer(<CustomerOrdersPage />) },
          { path: '/mijozlar/buyurtmalar/:id', element: customer(<OrderDetailsPage />) },
          { path: '/mijozlar/buyurtmalar/:orderId/tolov', element: customer(<PaymentPage />) },
          { path: '/ustalar/buyurtmalar', element: master(<OrdersPage />) },
          { path: '/ustalar/buyurtmalar/:id', element: master(<OrderDetailsPage />) },
          { path: '/ustalar/takliflar', element: master(<CreateOfferPage />) },
          { path: '/mijozlar/profil', element: customer(<CustomerProfilePage />) },
          { path: '/mijozlar/manzillar', element: customer(<CustomerPage />) },
          { path: '/mijozlar/chat', element: customer(<ChatPage />) },
          { path: '/mijozlar/kafolat', element: customer(<WarrantyPage />) },
          { path: '/mijozlar/shikoyatlar', element: customer(<ComplaintsPage />) },
          { path: '/mijozlar/nizolar', element: customer(<DisputesPage />) },
          { path: '/ustalar/profil', element: master(<MasterProfilePage />) },
          { path: '/ustalar/chat', element: master(<ChatPage />) },
          { path: '/ustalar/kafolat', element: master(<WarrantyPage />) },
          { path: '/ustalar/nizolar', element: master(<DisputesPage />) },
          { path: '/ustalar-katalogi', element: customer(<MasterPage />) },
          { path: '/ustalar-katalogi/:id', element: customer(<MasterDetailsPage />) },
          { path: '/bronlar', element: shared(<OrdersRedirect />) },
          { path: '/bronlar/:id', element: shared(<OrdersRedirect />) },
          { path: '/mijozlar/tolovlar', element: customer(<PaymentHistoryPage />) },
          { path: '/ustalar/faol-takliflar', element: master(<ActiveOffersPage />) },
          { path: '/ustalar/mening-takliflarim', element: master(<MyOffersPage />) },
          { path: '/ustalar/jadval', element: master(<MasterSchedulePage />) },
          { path: '/ustalar/portfolio', element: master(<MasterPortfolioPage />) },
          { path: '/ustalar/daromad', element: master(<EarningsPage />) },
          { path: '/huquqiy', element: shared(<LegalPage />) },
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
          { path: '/admin/devops', element: admin(<AdminDevOpsPage />) },
          { path: '/admin/suhbatlar', element: admin(<AdminChatsPage />) },
          { path: '/admin/xabarlar', element: admin(<ChatPage />) },
          { path: '/bildirishnomalar', element: <NotificationsPage /> },
          { path: '/sozlamalar', element: <SettingsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
