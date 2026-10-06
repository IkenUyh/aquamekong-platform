import React from 'react';
import { COLOR_METRICS, METRIC_SCALES, type ColorMetric } from '../../utils/metricScales';

/** Chọn chỉ số tô màu marker trạm: Độ mặn / Mực nước / Lưu lượng */
export function ColorMetricPicker({ value, onChange }: { value: ColorMetric; onChange: (m: ColorMetric) => void }) {
  return (
    <div role="radiogroup" aria-labelledby="color-metric-label">
      <p id="color-metric-label" className="field-label">Tô màu trạm theo</p>
      <div className="grid grid-cols-3 rounded-md border border-gray-300 overflow-hidden">
        {COLOR_METRICS.map((m, i) => {
          const active = m === value;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(m)}
              className={`px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300
                ${i > 0 ? 'border-l border-gray-300' : ''}
                ${active ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {METRIC_SCALES[m].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
