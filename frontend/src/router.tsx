import React, { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { RequireRole } from './components/RequireRole';
import { RouteError } from './components/RouteError';
import { LoginPage } from './pages/LoginPage';

// Mỗi trang là một chunk riêng: Leaflet/Recharts chỉ tải khi vào trang cần đến
const OverviewPage = lazy(() => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const StationsPage = lazy(() => import('./pages/StationsPage').then((m) => ({ default: m.StationsPage })));
const ForecastPage = lazy(() => import('./pages/ForecastPage').then((m) => ({ default: m.ForecastPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then((m) => ({ default: m.AlertsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function PageFallback() {
  return <div className="h-screen flex items-center justify-center text-sm text-gray-400">Đang tải...</div>;
}

const page = (element: React.ReactNode) => <Suspense fallback={<PageFallback />}>{element}</Suspense>;

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    // Mọi trang còn lại yêu cầu đăng nhập
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      { path: '/',          element: page(<OverviewPage />) },
      { path: '/map',       element: page(<MapPage />) },
      { path: '/stations',  element: page(<StationsPage />) },
      { path: '/forecast',  element: page(<ForecastPage />) },
      { path: '/alerts',    element: page(<AlertsPage />) },
      { path: '/reports',   element: page(<ReportsPage />) },
      { path: '/account',   element: page(<AccountPage />) },
      {
        element: <RequireRole roles={['ROLE_OPERATOR', 'ROLE_ADMIN']} />,
        children: [{ path: '/admin', element: page(<AdminPage />) }],
      },
      { path: '*',          element: <RouteError notFound /> },
    ],
  },
]);
