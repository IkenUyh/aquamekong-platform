import React from 'react';

const LEGEND_ITEMS = [
  { range: '≥ 20',   color: '#7F1D1D' },
  { range: '4 – 10', color: '#ef4444' },
  { range: '2 – 4',  color: '#eab308' },
  { range: '1 – 2',  color: '#84cc16' },
  { range: '0.5 – 1', color: '#22c55e' },
  { range: '< 0.5',  color: '#06b6d4' },
];

export function MapLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur
                    rounded-xl shadow-lg p-3 border border-gray-200">
      <h4 className="text-xs font-semibold text-gray-600 mb-2">Độ mặn (‰)</h4>
      <div className="space-y-1">
        {LEGEND_ITEMS.map(item => (
          <div key={item.range} className="flex items-center gap-2">
            <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-gray-600">{item.range}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-[10px] text-gray-400">
        <span>Thấp</span>
        <span>Cao</span>
      </div>
    </div>
  );
}
