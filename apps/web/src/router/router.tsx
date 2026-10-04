import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootShell } from './RootShell';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute, RedirectIfAuthed } from './ProtectedRoute';
import { OrdersRedirect } from './OrdersRedirect';
const RoleSelectPage = lazy(() => import('@/pages/RoleSelectPage').then((m) => ({ default: m.RoleSelectPage })));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const OtpPage = lazy(() => import('@/pages/auth/OtpPage').then((m) => ({ default: m.OtpPage })));
const CustomerOrdersPage = lazy(() => import('@/pages/orders/CustomerOrdersPage').then((m) => ({ default: m.CustomerOrdersPage })));
const CreateRequestPage = lazy(() => import('@/pages/requests/CreateRequestPage').then((m) => ({ default: m.CreateRequestPage })));
const RequestDetailsPage = lazy(() => import('@/pages/requests/RequestDetailsPage').then((m) => ({ default: m.RequestDetailsPage })));
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const OrderDetailsPage = lazy(() => import('@/pages/orders/OrderDetailsPage').then((m) => ({ default: m.OrderDetailsPage })));
const CreateOfferPage = lazy(() => import('@/pages/offers/CreateOfferPage').then((m) => ({ default: m.CreateOfferPage })));
const PaymentPage = lazy(() => import('@/pages/payments/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
import { NotFoundPage } from '@/pages/NotFoundPage';
const CustomerPage = lazy(() => import('@/pages/customer/CustomerPage').then((m) => ({ default: m.CustomerPage })));
const CustomerProfilePage = lazy(() => import('@/pages/customer/CustomerProfilePage').then((m) => ({ default: m.CustomerProfilePage })));
const MasterPage = lazy(() => import('@/pages/master/MasterPage').then((m) => ({ default: m.MasterPage })));
const MasterProfilePage = lazy(() => import('@/pages/master/MasterProfilePage').then((m) => ({ default: m.MasterProfilePage })));
const MasterDetailsPage = lazy(() => import('@/pages/master/MasterDetailsPage').then((m) => ({ default: m.MasterDetailsPage })));
const DisputesPage = lazy(() => import('@/pages/disputes/DisputesPage').then((m) => ({ default: m.DisputesPage })));
const ComplaintsPage = lazy(() => import('@/pages/complaints/ComplaintsPage').then((m) => ({ default: m.ComplaintsPage })));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const ChatPage = lazy(() => import('@/pages/chat/ChatPage').then((m) => ({ default: m.ChatPage })));
const WarrantyPage = lazy(() => import('@/pages/warranty/WarrantyPage').then((m) => ({ default: m.WarrantyPage })));

import { RoleGuard } from './RoleGuard';
const ActiveOffersPage = lazy(() => import('@/pages/offers/ActiveOffersPage').then((m) => ({ default: m.ActiveOffersPage })));
const MyOffersPage = lazy(() => import('@/pages/offers/MyOffersPage').then((m) => ({ default: m.MyOffersPage })));
const MasterSchedulePage = lazy(() => import('@/pages/master/MasterSchedulePage').then((m) => ({ default: m.MasterSchedulePage })));
const MasterPortfolioPage = lazy(() => import('@/pages/master/MasterPortfolioPage').then((m) => ({ default: m.MasterPortfolioPage })));
const EarningsPage = lazy(() => import('@/pages/payments/EarningsPage').then((m) => ({ default: m.EarningsPage })));
const PaymentHistoryPage = lazy(() => import('@/pages/payments/PaymentHistoryPage').then((m) => ({ default: m.PaymentHistoryPage })));
const LegalPage = lazy(() => import('@/pages/legal/LegalPage').then((m) => ({ default: m.LegalPage })));
const TermsPage = lazy(() => import('@/pages/legal/TermsPage').then((m) => ({ default: m.TermsPage })));
const SafetyPage = lazy(() => import('@/pages/safety/SafetyPage').then((m) => ({ default: m.SafetyPage })));
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
import { lazy } from 'react';
import type { ReactNode } from 'react';
import type { Role } from '@/types/common';

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
