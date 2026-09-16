import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { MapPage } from './pages/MapPage';
import { OverviewPage } from './pages/OverviewPage';
import { StationsPage } from './pages/StationsPage';
import { AlertsPage } from './pages/AlertsPage';
import { ForecastPage } from './pages/ForecastPage';
import { ReportsPage } from './pages/ReportsPage';

export const router = createBrowserRouter([
  { path: '/',          element: <OverviewPage /> },
  { path: '/map',       element: <MapPage /> },
  { path: '/stations',  element: <StationsPage /> },
  { path: '/forecast',  element: <ForecastPage /> },
  { path: '/alerts',    element: <AlertsPage /> },
  { path: '/reports',   element: <ReportsPage /> },
]);
