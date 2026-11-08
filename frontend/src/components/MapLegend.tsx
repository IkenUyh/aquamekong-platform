import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { METRIC_SCALES, type ColorMetric } from '../utils/metricScales';

/** Từ sm trở lên chú giải mở sẵn; trên điện thoại bảng đầy đủ che khoảng 1/3 bản đồ nên thu gọn, chạm để mở */
const startsOpen = () => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches;

/** Chú giải theo chỉ số đang dùng để tô màu marker trạm. */
export function MapLegend({ metric }: { metric: ColorMetric }) {
  const scale = METRIC_SCALES[metric];
  const [open, setOpen] = useState(startsOpen);

  return (
    <div className="absolute bottom-6 left-3 sm:left-6 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 text-xs">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-10 items-center gap-2 px-3 py-2 font-semibold text-gray-600"
      >
        {scale.label} ({scale.unit})
        {/* Thu gọn vẫn thấy dải màu */}
        {!open && (
          <span className="flex gap-1" aria-hidden="true">
            {scale.bins.map((b) => (
              <span key={b.key} className="w-2.5 h-2.5 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" style={{ backgroundColor: b.color }} />
            ))}
          </span>
        )}
        <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className="space-y-1">
            {scale.bins.map((b) => (
              <div key={b.key} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" style={{ backgroundColor: b.color }} />
                <span className="text-gray-600 num">{b.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Số đo mới nhất của từng trạm</p>
        </div>
      )}
    </div>
  );
}
