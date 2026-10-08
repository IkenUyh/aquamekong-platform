import React from 'react';
import { METRIC_SCALES, type ColorMetric } from '../utils/metricScales';

/** Chú giải theo chỉ số đang dùng để tô màu marker trạm. */
export function MapLegend({ metric }: { metric: ColorMetric }) {
  const scale = METRIC_SCALES[metric];
  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg p-3 border border-gray-200 text-xs">
      <h4 className="font-semibold text-gray-600 mb-2">{scale.label} ({scale.unit})</h4>
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
  );
}
