import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  Droplets, LayoutDashboard, Map, Radio, TrendingUp, AlertTriangle, FileText, Wifi, WifiOff, LogOut, UserCircle, Settings, Menu, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: 'Quản trị',
  ROLE_OPERATOR: 'Vận hành',
  ROLE_USER: 'Người dùng',
};

interface NavItem {
  label: string;
  /** Nhãn ngắn cho màn hình hẹp (lg–2xl) để menu không xuống dòng */
  short: string;
  path: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan',      short: 'Tổng quan', path: '/',         icon: LayoutDashboard },
  { label: 'Bản đồ độ mặn',  short: 'Bản đồ',    path: '/map',      icon: Map },
  { label: 'Trạm quan trắc', short: 'Trạm',      path: '/stations', icon: Radio },
  { label: 'Dự báo',         short: 'Dự báo',    path: '/forecast', icon: TrendingUp },
  { label: 'Cảnh báo',       short: 'Cảnh báo',  path: '/alerts',   icon: AlertTriangle },
  { label: 'Báo cáo',        short: 'Báo cáo',   path: '/reports',  icon: FileText },
  { label: 'Quản trị',       short: 'Quản trị',  path: '/admin',    icon: Settings, roles: ['ROLE_OPERATOR', 'ROLE_ADMIN'] },
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
    <div
      title={isOfflineMode ? 'API không phản hồi — đang hiển thị dữ liệu mẫu (chế độ dev)' : 'Đang nhận dữ liệu từ máy chủ'}
      className={`flex items-center gap-2 px-2 2xl:px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap
                  ${isOfflineMode ? 'bg-orange-500/20 text-orange-200' : 'bg-green-500/20 text-green-200'}`}
    >
      {isOfflineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
      <span className="hidden 2xl:inline">{isOfflineMode ? 'Dữ liệu mẫu' : 'Trực tuyến'}</span>
    </div>
  );

  return (
    <header className="relative h-14 bg-primary flex items-center justify-between px-4 lg:px-6 shadow-md z-[1100] shrink-0">
      <div className="flex items-center min-w-0">
        {/* Logo */}
        <div className="flex items-center gap-2 text-white font-bold text-lg mr-4 xl:mr-8 shrink-0">
          <Droplets className="w-6 h-6" />
          {/* lg–xl: chỉ icon để đủ chỗ cho 7 tab */}
          <span className="lg:hidden xl:inline">AquaMekong</span>
        </div>
        {/* Nav tabs (≥ lg) */}
        <nav className="hidden lg:flex gap-1 h-full items-end mt-2">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} title={item.label}
              className={({ isActive }) =>
                `px-2.5 xl:px-3 2xl:px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                 ${isActive ? 'bg-white text-primary border-primary' : 'text-white/80 hover:text-white hover:bg-white/10 border-transparent'}`
              }>
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4" />
                <span className="2xl:hidden">{item.short}</span>
                <span className="hidden 2xl:inline">{item.label}</span>
              </div>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 xl:gap-3">
        {status}

        {/* User + đăng xuất (≥ lg) */}
        {user && (
          <div className="hidden lg:flex items-center gap-1 text-white">
            <NavLink to="/account" title="Tài khoản / đổi mật khẩu"
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10">
              <UserCircle className="w-5 h-5 opacity-80 shrink-0" />
              <div className="leading-tight hidden 2xl:block">
                <p className="text-sm font-semibold whitespace-nowrap">{user.fullName || user.username}</p>
                {roleLabel && <p className="text-[10px] text-white/70">{roleLabel}</p>}
              </div>
            </NavLink>
            <button onClick={() => logout()} title="Đăng xuất"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 whitespace-nowrap">
              <LogOut className="w-4 h-4" />
              <span className="hidden 2xl:inline">Đăng xuất</span>
            </button>
          </div>
        )}

        {/* Nút menu (< lg) */}
        <button
          className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Menu thả xuống (< lg) */}
      {menuOpen && (
        <div className="lg:hidden absolute top-14 inset-x-0 bg-white border-b border-gray-200 shadow-lg">
          <nav className="p-2 grid grid-cols-2 gap-1">
            {navItems.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="border-t border-gray-100 p-3 flex items-center justify-between gap-2">
              <NavLink to="/account" className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                <UserCircle className="w-5 h-5 text-gray-400 shrink-0" />
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
