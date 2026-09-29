import React from 'react';
import { Droplets, Radio, Wifi, WifiOff } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isConnected: boolean;
}

export function Layout({ children, sidebar, sidebarOpen, onToggleSidebar, isConnected }: LayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <div
        className={`glass-panel h-full transition-all duration-300 ease-in-out flex flex-col ${
          sidebarOpen ? 'w-[380px]' : 'w-0'
        } overflow-hidden`}
      >
        {sidebar}
      </div>

      {/* Main content (Map) */}
      <div className="flex-1 relative">
        {/* Top bar */}
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-3">
          {/* Toggle sidebar */}
          <button
            onClick={onToggleSidebar}
            className="glass-card px-4 py-2.5 flex items-center gap-2 hover:bg-dark-card/80 
                       transition-all cursor-pointer shadow-lg hover:shadow-xl"
            id="toggle-sidebar-btn"
          >
            <Droplets className="w-5 h-5 text-aqua-400" />
            <span className="font-bold text-sm text-aqua-300">AquaMekong</span>
          </button>

          {/* Connection status */}
          <div
            className={`glass-card px-3 py-2 flex items-center gap-2 text-xs font-medium ${
              isConnected ? 'text-green-400' : 'text-red-400'
            }`}
            id="connection-status"
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Live</span>
                <Radio className="w-3 h-3 animate-pulse" />
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
