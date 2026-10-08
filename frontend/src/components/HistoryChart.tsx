import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Measurement } from '../types';
import { SALINITY_THRESHOLD } from '../utils/salinity';

interface HistoryChartProps {
  /** Chỉ số độ mặn (metricType = salinity), mới nhất trước — như API trả về */
  metrics: Measurement[];
  stationName: string;
  threshold?: number;
}

export function HistoryChart({ metrics, stationName, threshold = SALINITY_THRESHOLD }: HistoryChartProps) {
  const sorted = [...metrics].reverse(); // thứ tự thời gian
  const spansDays =
    sorted.length > 1 &&
    new Date(sorted[sorted.length - 1].recordedAt).toDateString() !== new Date(sorted[0].recordedAt).toDateString();

  // Số đo theo ngày (RYNAN, ghi lúc 00:00): giờ không mang thông tin, chỉ hiện ngày
  const daily = sorted.every((m) => { const d = new Date(m.recordedAt); return d.getHours() === 0 && d.getMinutes() === 0; });

  const data = sorted.map((m) => {
    const d = new Date(m.recordedAt);
    return {
      time: daily && spansDays
        ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        : spansDays
        ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      salinity: Math.round(m.value * 100) / 100,
    };
  });

  return (
    <div className="p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Diễn biến độ mặn {stationName && `tại ${stationName}`}
      </h3>
      <div className="flex-1 min-h-[180px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            Chưa có số liệu độ mặn trong khoảng thời gian này
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="time" tick={{ fill: '#718096', fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fill: '#718096', fontSize: 11 }} label={{ value: '‰', position: 'insideTopLeft' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                itemStyle={{ color: '#4A5568', fontWeight: 500 }}
                labelStyle={{ color: '#A0AEC0', fontSize: '12px', marginBottom: '4px' }}
              />
              <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Ngưỡng ${threshold}‰`, fill: '#ef4444', fontSize: 11 }} />
              <Line type="monotone" dataKey="salinity" name="Độ mặn (‰)" stroke="#0F3D5E" strokeWidth={2} dot={data.length < 30} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
