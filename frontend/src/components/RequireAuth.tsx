import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Checking() {
  return <div className="h-screen flex items-center justify-center text-sm text-gray-400">Đang kiểm tra đăng nhập...</div>;
}

/**
 * Bọc các route cần đăng nhập; chưa đăng nhập -> /login (quay lại trang cũ sau khi đăng nhập).
 * `allowPublic`: trang dữ liệu, người chưa đăng nhập vẫn xem được nếu backend bật PUBLIC_READ_ENABLED.
 */
export function RequireAuth({ allowPublic = false }: { allowPublic?: boolean }) {
  const { status, config } = useAuth();
  const location = useLocation();

  if (allowPublic) {
    if (!config) return <Checking />;
    if (config.publicRead) return <Outlet />;
  }
  if (status === 'loading') return <Checking />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
