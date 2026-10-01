import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Bọc các route cần đăng nhập; chưa đăng nhập -> /login (quay lại trang cũ sau khi đăng nhập). */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="h-screen flex items-center justify-center text-sm text-gray-400">Đang kiểm tra đăng nhập...</div>;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
