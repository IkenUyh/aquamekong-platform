import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Droplets, LayoutDashboard, Map, Radio, TrendingUp, AlertTriangle, FileText, Wifi, WifiOff } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Tổng quan',        path: '/',           icon: LayoutDashboard },
  { label: 'Bản đồ độ mặn',   path: '/map',        icon: Map },
  { label: 'Trạm quan trắc',  path: '/stations',   icon: Radio },
  { label: 'Dự báo',          path: '/forecast',   icon: TrendingUp },
  { label: 'Cảnh báo',        path: '/alerts',     icon: AlertTriangle },
  { label: 'Báo cáo',         path: '/reports',    icon: FileText },
];

export function Navbar() {
  const location = useLocation();
  const isOfflineMode = useSelector((state: RootState) => state.network.isOfflineMode);

  return (
    <header className="h-14 bg-primary flex items-center justify-between px-6 shadow-md z-20">
      <div className="flex items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 text-white font-bold text-lg mr-8">
          <Droplets className="w-6 h-6" />
          AquaMekong
        </div>
        {/* Nav tabs */}
        <nav className="flex gap-1 h-full items-end mt-2">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) =>
                `px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2
                 ${isActive ? 'bg-white text-primary border-primary' : 'text-white/80 hover:text-white hover:bg-white/10 border-transparent'}`
              }>
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Network Status Indicator */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
                      ${isOfflineMode ? 'bg-orange-500/20 text-orange-200' : 'bg-green-500/20 text-green-200'}`}>
        {isOfflineMode ? (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline Mode</span>
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>Live Data</span>
          </>
        )}
      </div>
    </header>
  );
}

