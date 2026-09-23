import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { WaterMetric } from '../types';

interface HistoryChartProps {
  metrics: WaterMetric[];
  stationName: string;
  threshold?: number;  // ngưỡng mặn (mặc định 4‰)
}

export function HistoryChart({ metrics, stationName, threshold = 4 }: HistoryChartProps) {
  const data = metrics.map(m => ({
    time: new Date(m.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    salinity: m.salinity ?? m.value ?? 0,
    waterLevel: m.waterLevel ?? 0,
  })).reverse(); // chronological order

  return (
    <div className="p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Diễn biến độ mặn tại trạm {stationName}
      </h3>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="time" tick={{ fill: '#718096', fontSize: 11 }} />
            <YAxis tick={{ fill: '#718096', fontSize: 11 }} label={{ value: '‰', position: 'insideTopLeft' }} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }} 
              itemStyle={{ color: '#4A5568', fontWeight: 500 }}
              labelStyle={{ color: '#A0AEC0', fontSize: '12px', marginBottom: '4px' }}
            />
            {/* Threshold line (ngưỡng 4‰) */}
            <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Ngưỡng ${threshold}‰`, fill: '#ef4444', fontSize: 11 }} />
            {/* Salinity line */}
            <Line type="monotone" dataKey="salinity" name="Độ mặn" stroke="#4A90D9" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
