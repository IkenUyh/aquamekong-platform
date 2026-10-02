import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';

/** 2 chữ cái đầu của tên, dùng làm avatar */
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() ?? '').join('');

const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: 'Quản trị',
  ROLE_OPERATOR: 'Vận hành',
  ROLE_USER: 'Người dùng',
};

interface NavItem {
  label: string;
  /** Nhãn ngắn cho lg–xl để 7 tab không xuống dòng */
  short: string;
  path: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan',      short: 'Tổng quan', path: '/' },
  { label: 'Bản đồ độ mặn',  short: 'Bản đồ',    path: '/map' },
  { label: 'Trạm quan trắc', short: 'Trạm',      path: '/stations' },
  { label: 'Dự báo',         short: 'Dự báo',    path: '/forecast' },
  { label: 'Cảnh báo',       short: 'Cảnh báo',  path: '/alerts' },
  { label: 'Báo cáo',        short: 'Báo cáo',   path: '/reports' },
  { label: 'Quản trị',       short: 'Quản trị',  path: '/admin', roles: ['ROLE_OPERATOR', 'ROLE_ADMIN'] },
];

export function Navbar() {
  const isOfflineMode = useSelector((state: RootState) => state.network.isOfflineMode);
  const { user, logout, hasRole } = useAuth();
  const navItems = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles));
  const roleLabel = user?.roles?.map((r) => ROLE_LABELS[r] ?? r).join(', ');
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  // Đóng menu mobile khi đổi trang
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

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

        {/* Nút menu (< lg) */}
        <button
          className="lg:hidden p-2 rounded-md text-white hover:bg-white/10"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Menu thả xuống (< lg) */}
      {menuOpen && (
        <div className="lg:hidden absolute top-14 inset-x-0 bg-white border-b border-gray-200 shadow-md">
          <nav className="p-2 grid grid-cols-2 gap-1">
            {navItems.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-md text-sm ${isActive ? 'bg-primary-50 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="border-t border-gray-100 p-3 flex items-center justify-between gap-2">
              <NavLink to="/account" className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                <span className="truncate">{user.fullName || user.username}{roleLabel && <span className="text-xs text-gray-400"> · {roleLabel}</span>}</span>
              </NavLink>
              <button onClick={() => logout()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 shrink-0">
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
