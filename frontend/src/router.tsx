import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useFarmerMode } from './hooks/useFarmerMode';
import { RequireAuth } from './components/RequireAuth';
import { RequireRole } from './components/RequireRole';
import { RouteError } from './components/RouteError';
import { LoginPage } from './pages/LoginPage';
import { ZALO_CALLBACK_PATH } from './auth/zaloOAuth';

// Mỗi trang là một chunk riêng: Leaflet/Recharts chỉ tải khi vào trang cần đến
const OverviewPage = lazy(() => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const StationsPage = lazy(() => import('./pages/StationsPage').then((m) => ({ default: m.StationsPage })));
const ForecastPage = lazy(() => import('./pages/ForecastPage').then((m) => ({ default: m.ForecastPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then((m) => ({ default: m.AlertsPage })));
const ReplayPage = lazy(() => import('./pages/ReplayPage').then((m) => ({ default: m.ReplayPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const FieldsPage = lazy(() => import('./pages/FieldsPage').then((m) => ({ default: m.FieldsPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ZaloCallbackPage = lazy(() => import('./pages/ZaloCallbackPage').then((m) => ({ default: m.ZaloCallbackPage })));
const FarmerPage = lazy(() => import('./pages/FarmerPage').then((m) => ({ default: m.FarmerPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function PageFallback() {
  return <div className="h-screen flex items-center justify-center text-sm text-gray-400">Đang tải...</div>;
}

const page = (element: React.ReactNode) => <Suspense fallback={<PageFallback />}>{element}</Suspense>;

/** Trang chủ: bật chế độ Nông dân thì vào thẳng màn hình "Tuần này lấy nước được không?" */
function Home() {
  const { on } = useFarmerMode();
  return on ? <Navigate to="/nong-dan" replace /> : page(<OverviewPage />);
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  { path: '/register', element: page(<RegisterPage />), errorElement: <RouteError /> },
  // Hồ sơ ruộng dùng chung: không cần đăng nhập, kể cả khi tắt xem công khai (PUBLIC_READ_ENABLED=false)
  { path: '/fields', element: page(<FieldsPage />), errorElement: <RouteError /> },
  // Chế độ Nông dân: công khai, bố cục riêng gọn nhẹ (không bản đồ, không biểu đồ)
  { path: '/nong-dan', element: page(<FarmerPage />), errorElement: <RouteError /> },
  { path: ZALO_CALLBACK_PATH, element: page(<ZaloCallbackPage />), errorElement: <RouteError /> },
  {
    // Trang dữ liệu: ai cũng xem được (nếu backend bật PUBLIC_READ_ENABLED), thao tác ghi cần đăng nhập
    element: <RequireAuth allowPublic />,
    errorElement: <RouteError />,
    children: [
      { path: '/',          element: <Home /> },
      { path: '/map',       element: page(<MapPage />) },
      { path: '/stations',  element: page(<StationsPage />) },
      { path: '/forecast',  element: page(<ForecastPage />) },
      { path: '/alerts',    element: page(<AlertsPage />) },
      { path: '/reports',   element: page(<ReportsPage />) },
      { path: '/replay',    element: page(<ReplayPage />) },
      { path: '*',          element: <RouteError notFound /> },
    ],
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      { path: '/account',   element: page(<AccountPage />) },
      {
        element: <RequireRole roles={['ROLE_OPERATOR', 'ROLE_ADMIN']} />,
        children: [{ path: '/admin', element: page(<AdminPage />) }],
      },
    ],
  },
]);
