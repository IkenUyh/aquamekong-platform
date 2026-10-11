import { Link } from 'react-router-dom';
import React from 'react';
import type { SalinityForecast } from '../types';
import {
  classifySalinity, formatDay, formatSalinity, SALINITY_CLASS_COLORS, SALINITY_CLASS_SHORT_LABELS,
} from '../utils/salinity';

interface ForecastSummaryPanelProps {
  forecasts: SalinityForecast[];
  /** Tên trạm đang chọn: mức nguy cơ ở đây là của một trạm, không phải cả vùng */
  stationName?: string;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()];

export function ForecastSummaryPanel({ forecasts, stationName }: ForecastSummaryPanelProps) {
  if (forecasts.length === 0) return null;
  const peak = forecasts.reduce((a, b) => (b.predictedSalinity > a.predictedSalinity ? b : a));
  const peakClass = classifySalinity(peak.predictedSalinity);
  const days = forecasts.slice(0, 7);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Dự báo {days.length} ngày tới{stationName && <span className="font-normal text-gray-600"> tại {stationName}</span>}
        </h3>
        <Link to="/forecast" className="text-primary text-xs font-medium hover:underline whitespace-nowrap">Xem chi tiết</Link>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        Cao nhất{' '}
        <span className="font-semibold num" style={{ color: peakClass === 'UNKNOWN' ? undefined : SALINITY_CLASS_COLORS[peakClass] }}>
          {formatSalinity(peak.predictedSalinity)}‰
        </span>
        {' '}· mức {SALINITY_CLASS_SHORT_LABELS[peakClass].toLowerCase()}, ngày <span className="num">{formatDay(peak.forecastDate)}</span>
      </p>

      {/* Mỗi ngày: thứ, giá trị; nền nhạt theo mức (giá trị vẫn ghi bằng số, không chỉ dựa vào màu) */}
      <ol className="grid grid-cols-7 gap-1">
        {days.map((f) => {
          const c = classifySalinity(f.predictedSalinity);
          return (
            <li key={f.forecastDate} title={`${formatDay(f.forecastDate)}: ${formatSalinity(f.predictedSalinity)}‰ (${SALINITY_CLASS_SHORT_LABELS[c]})`}
              className="min-w-0 rounded-md py-1.5 text-center" style={{ backgroundColor: `${SALINITY_CLASS_COLORS[c]}1f` }}>
              <p className="text-[10px] font-medium text-gray-600">{weekday(f.forecastDate)}</p>
              <p className="text-[11px] font-semibold text-gray-900 num">{formatSalinity(f.predictedSalinity)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
