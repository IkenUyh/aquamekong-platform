import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUnresolvedAlerts } from '../hooks/useAlerts';
import { NAV_ITEMS, ROLE_LABELS } from './navItems';

const tabClass = (active: boolean) =>
  `flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] ${
    active ? 'text-primary font-semibold' : 'text-gray-500'}`;

/**
 * Thanh tab dưới cùng trên điện thoại (< lg), cho cả app lẫn web: 4 trang chính + "Thêm"
 * mở bảng các trang còn lại và tài khoản. Đặt làm phần tử cuối của cột flex h-dvh của trang.
 */
export function BottomNav() {
  const { user, logout, hasRole } = useAuth();
  const { data: openAlerts } = useUnresolvedAlerts();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  // Đóng bảng "Thêm" khi đổi trang
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMoreOpen(false);
  }

  const items = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles));
  const primary = items.filter((item) => item.primary);
  const more = items.filter((item) => !item.primary);
  const inMore = pathname === '/account' || more.some((item) => pathname.startsWith(item.path));
  const roleLabel = user?.roles?.map((r) => ROLE_LABELS[r] ?? r).join(', ');
  const alertCount = openAlerts?.length ?? 0;

  return (
    <div className="lg:hidden relative shrink-0 z-[1100]">
      {moreOpen && (
        <>
          <button aria-label="Đóng" className="fixed inset-0 bg-black/20 cursor-default" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-full inset-x-0 bg-white border-t border-gray-200 rounded-t-xl shadow-lg">
            <nav className="p-2 grid grid-cols-3 gap-1">
              {more.map(({ path, short, icon: Icon }) => (
                <NavLink key={path} to={path}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 px-2 py-3 rounded-lg text-xs ${
                      isActive ? 'bg-primary-50 text-primary font-semibold' : 'text-gray-700'}`}>
                  <Icon className="w-5 h-5" />
                  {short}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-gray-100 p-3">
              {user ? (
                <div className="flex items-center justify-between gap-2">
                  <NavLink to="/account" className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                    <UserRound className="w-4 h-4 shrink-0" />
                    <span className="truncate">{user.fullName || user.username}{roleLabel && <span className="text-xs text-gray-400"> · {roleLabel}</span>}</span>
                  </NavLink>
                  <button onClick={() => logout()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 shrink-0">
                    <LogOut className="w-4 h-4" /> Đăng xuất
                  </button>
                </div>
              ) : (
                <NavLink to="/login" state={{ from: pathname }} className="btn-primary w-full py-2">Đăng nhập</NavLink>
              )}
            </div>
          </div>
        </>
      )}

      <nav aria-label="Điều hướng chính"
        className="relative flex bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        {primary.map(({ path, short, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => tabClass(isActive && !moreOpen)}>
            <span className="relative">
              <Icon className="w-5 h-5" />
              {path === '/alerts' && alertCount > 0 && (
                <span className="absolute -top-1.5 left-3 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-4 text-center">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </span>
            {short}
          </NavLink>
        ))}
        <button className={tabClass(moreOpen || inMore)} aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
          <Menu className="w-5 h-5" />
          Thêm
        </button>
      </nav>
    </div>
  );
}
