import { Link } from 'react-router-dom';
import React from 'react';
import type { SalinityForecast } from '../types';
import { classifySalinity, SALINITY_CLASS_COLORS, SALINITY_CLASS_SHORT_LABELS } from '../utils/salinity';

interface ForecastSummaryPanelProps {
  forecasts: SalinityForecast[];
}

// Classify risk từ predicted salinity
function classifyRisk(salinity: number): { level: string; color: string } {
  const c = classifySalinity(salinity);
  return { level: c === 'MEDIUM' ? 'TB' : SALINITY_CLASS_SHORT_LABELS[c], color: SALINITY_CLASS_COLORS[c] };
}

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function ForecastSummaryPanel({ forecasts }: ForecastSummaryPanelProps) {
  // Overall risk = max predicted salinity
  const maxSalinity = Math.max(...forecasts.map(f => f.predictedSalinity));
  const overallRisk = classifyRisk(maxSalinity);

  const dateRange = forecasts.length > 0
    ? `${formatDate(forecasts[0].forecastDate)} - ${formatDate(forecasts[forecasts.length-1].forecastDate)}`
    : '';

  return (
    <div className="card p-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-800">Dự báo những ngày tới</h3>
        <Link to="/forecast" className="text-primary-500 text-xs hover:underline">Xem chi tiết &gt;</Link>
      </div>

      {/* Overall risk */}
      <div className="mb-3">
        <p className="text-xs text-gray-500">Nguy cơ xâm nhập mặn</p>
        <p className="text-2xl font-bold" style={{ color: overallRisk.color }}>
          {overallRisk.level.toUpperCase()}
        </p>
        <p className="text-xs text-gray-400">{dateRange}</p>
      </div>

      {/* Daily badges */}
      <div className="flex gap-1.5">
        {forecasts.slice(0, 7).map((f, i) => {
          const risk = classifyRisk(f.predictedSalinity);
          const day = DAY_LABELS[new Date(f.forecastDate).getDay()];
          return (
            <div key={i} className="flex-1 text-center rounded-lg py-2"
                 style={{ backgroundColor: risk.color + '20' }}>
              <p className="text-[10px] text-gray-500">{day}</p>
              <p className="text-[10px] text-gray-400">
                {new Date(f.forecastDate).getDate()}/{new Date(f.forecastDate).getMonth()+1}
              </p>
              <p className="text-xs font-bold mt-1" style={{ color: risk.color }}>
                {risk.level}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
