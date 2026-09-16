import React from 'react';
import { Navbar } from '../components/Navbar';

interface DashboardLayoutProps {
  leftPanel: React.ReactNode;
  centerContent: React.ReactNode;
  bottomContent?: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function DashboardLayout({ leftPanel, centerContent, bottomContent, rightPanel }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside className="w-[280px] bg-white border-r border-[var(--color-border)] overflow-y-auto z-10 flex flex-col">
          {leftPanel}
        </aside>

        {/* Center: map + bottom chart */}
        <main className="flex-1 flex flex-col relative z-0">
          <div className="flex-1 relative">{centerContent}</div>
          {bottomContent && (
            <div className="h-[280px] bg-white border-t border-[var(--color-border)] z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              {bottomContent}
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="w-[320px] bg-[var(--color-bg)] border-l border-[var(--color-border)] overflow-y-auto p-4 space-y-4 z-10">
          {rightPanel}
        </aside>
      </div>
    </div>
  );
}
