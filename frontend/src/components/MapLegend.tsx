import React from 'react';
import { HEAT_SCALES, type HeatMetric } from '../utils/heatScales';
import { SALINITY_CLASS_COLORS, SALINITY_CLASS_LABELS, type SalinityClass } from '../utils/salinity';

const SALINITY_ORDER: SalinityClass[] = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

/** Chú giải theo lớp nhiệt đang bật; marker trạm luôn tô theo thang độ mặn. */
export function MapLegend({ metric }: { metric: HeatMetric | null }) {
  const scale = metric && metric !== 'salinity' ? HEAT_SCALES[metric] : null;
  const stops = scale ? Object.entries(scale.gradient).sort((a, b) => Number(a[0]) - Number(b[0])) : [];

  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur rounded-xl shadow-lg p-3 border border-gray-200 text-xs space-y-3">
      <div>
        <h4 className="font-semibold text-gray-600 mb-2">Độ mặn (marker trạm)</h4>
        <div className="space-y-1">
          {SALINITY_ORDER.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SALINITY_CLASS_COLORS[c] }} />
              <span className="text-gray-600">{SALINITY_CLASS_LABELS[c]}</span>
            </div>
          ))}
        </div>
      </div>

      {scale && (
        <div className="pt-2 border-t border-gray-100">
          <h4 className="font-semibold text-gray-600 mb-2">Lớp nhiệt: {scale.label} ({scale.unit})</h4>
          <div className="h-2 w-40 rounded" style={{ background: `linear-gradient(to right, ${stops.map(([p, c]) => `${c} ${Number(p) * 100}%`).join(', ')})` }} />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>0</span>
            <span>≥ {scale.max.toLocaleString('vi-VN')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
