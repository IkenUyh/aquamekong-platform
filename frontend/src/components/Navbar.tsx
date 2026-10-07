import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { initials, NAV_ITEMS, ROLE_LABELS } from './navItems';

export function Navbar() {
  const isOfflineMode = useSelector((state: RootState) => state.network.isOfflineMode);
  const { user, logout, hasRole } = useAuth();
  const navItems = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles));
  const roleLabel = user?.roles?.map((r) => ROLE_LABELS[r] ?? r).join(', ');
  const { pathname } = useLocation();

  const status = (
    <span
      title={isOfflineMode ? 'API không phản hồi — đang hiển thị dữ liệu mẫu (chế độ dev)' : 'Đang nhận dữ liệu từ máy chủ'}
      className="flex items-center gap-1.5 text-xs text-white/80 whitespace-nowrap"
    >
      <span className={`dot ${isOfflineMode ? 'bg-orange-400' : 'bg-green-400'}`} />
      <span className="hidden xl:inline">{isOfflineMode ? 'Dữ liệu mẫu' : 'Trực tuyến'}</span>
    </span>
  );

  return (
    <header className="relative h-14 bg-primary flex items-center justify-between px-4 lg:px-6 z-[1100] shrink-0">
      <div className="flex items-center min-w-0 h-full">
        <NavLink to="/" className="mr-6 xl:mr-10 shrink-0" aria-label="AquaMekong — Tổng quan">
          <Logo tone="light" />
        </NavLink>
        {/* Tab chữ, tab đang chọn gạch chân (≥ lg) */}
        <nav className="hidden lg:flex h-full items-stretch gap-1">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} title={item.label}
              className={({ isActive }) =>
                `flex items-center px-2.5 xl:px-3 text-sm whitespace-nowrap border-b-2 transition-colors
                 ${isActive ? 'border-white text-white font-semibold' : 'border-transparent text-white/70 hover:text-white'}`
              }>
              <span className="xl:hidden">{item.short}</span>
              <span className="hidden xl:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 xl:gap-4">
        {status}

        {/* User + đăng xuất (≥ lg) */}
        {user && (
          <div className="hidden lg:flex items-center gap-1 text-white">
            <NavLink to="/account" title="Tài khoản / đổi mật khẩu"
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/10">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                {initials(user.fullName || user.username)}
              </span>
              <span className="leading-tight hidden xl:block text-left">
                <span className="block text-sm font-medium whitespace-nowrap">{user.fullName || user.username}</span>
                {roleLabel && <span className="block text-[11px] text-white/60">{roleLabel}</span>}
              </span>
            </NavLink>
            <button onClick={() => logout()} title="Đăng xuất"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-white/80 hover:text-white hover:bg-white/10 whitespace-nowrap">
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Đăng xuất</span>
            </button>
          </div>
        )}

        {/* Chưa đăng nhập: vẫn xem được dữ liệu, nút đăng nhập để nhận cảnh báo / thao tác */}
        {!user && (
          <NavLink to="/login" state={{ from: pathname }}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-white text-primary hover:bg-white/90 whitespace-nowrap">
            Đăng nhập
          </NavLink>
        )}
      </div>
    </header>
  );
}
