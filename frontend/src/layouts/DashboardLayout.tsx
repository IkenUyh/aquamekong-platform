import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { BottomNav } from '../components/BottomNav';

interface DashboardLayoutProps {
  leftPanel: React.ReactNode;
  centerContent: React.ReactNode;
  bottomContent?: React.ReactNode;
  /** Bỏ trống để vùng giữa chiếm hết phần còn lại */
  rightPanel?: React.ReactNode;
  /**
   * Chiều cao vùng giữa khi < lg. Mặc định cao theo nội dung (cả trang cuộn);
   * nội dung cần chiều cao cố định (bản đồ) truyền vd. "h-[60vh]".
   */
  mobileCenterHeight?: string;
}

/**
 * 3 cột (bộ lọc | nội dung | panel phải) từ lg trở lên; dưới lg xếp dọc, cả trang cuộn,
 * bộ lọc thu gọn sau nút "Bộ lọc".
 */
export function DashboardLayout({ leftPanel, centerContent, bottomContent, rightPanel, mobileCenterHeight = '' }: DashboardLayoutProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col h-dvh w-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <Navbar />

      <div className="flex flex-1 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left panel */}
        <aside className="w-full lg:w-[280px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[var(--color-border)] lg:overflow-y-auto z-10 flex flex-col">
          <button
            className="lg:hidden flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Bộ lọc</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`${filtersOpen ? 'block' : 'hidden'} lg:block lg:flex-1`}>{leftPanel}</div>
        </aside>

        {/* Center: nội dung chính + biểu đồ dưới */}
        <main className="flex-1 flex flex-col relative z-0 min-w-0">
          {/* lg:min-h-0: không thì vùng giữa cao theo nội dung, cột cuộn bên trong không cuộn được */}
          <div className={`relative ${mobileCenterHeight} lg:h-auto lg:flex-1 lg:min-h-0 shrink-0`}>{centerContent}</div>
          {bottomContent && (
            <div className="h-[280px] shrink-0 bg-white border-t border-[var(--color-border)] z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] overflow-x-auto">
              {bottomContent}
            </div>
          )}
        </main>

        {/* Right panel */}
        {rightPanel && (
          <aside className="w-full lg:w-[320px] shrink-0 bg-[var(--color-bg)] border-t lg:border-t-0 lg:border-l border-[var(--color-border)] lg:overflow-y-auto p-4 space-y-4 z-10">
            {rightPanel}
          </aside>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
