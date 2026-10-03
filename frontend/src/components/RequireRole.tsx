import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from './Navbar';

/** Chặn route theo vai trò (đặt bên trong RequireAuth). Backend vẫn kiểm tra quyền ở từng API. */
export function RequireRole({ roles }: { roles: string[] }) {
  const { hasRole } = useAuth();
  if (hasRole(...roles)) return <Outlet />;
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="font-semibold text-gray-700">Bạn không có quyền truy cập trang này</p>
          <Link to="/" className="inline-block text-sm font-medium text-primary-600 hover:underline">Về trang Tổng quan</Link>
        </div>
      </div>
    </div>
  );
}
