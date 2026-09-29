import React from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import type { SalinityForecast } from '../types';

interface ForecastChartProps {
  forecasts: SalinityForecast[];
}

export function ForecastChart({ forecasts }: ForecastChartProps) {
  const data = forecasts.map((f) => ({
    date: new Date(f.forecastDate).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    }),
    salinity: f.predictedSalinity,
    lower: f.lowerBound,
    upper: f.upperBound,
    confidence: Math.round((f.confidenceLevel || 0) * 100),
  }));

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="salinityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4A90D9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4A90D9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E2E8F0" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#E2E8F0" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
            label={{ value: '‰', position: 'insideTopLeft', fill: '#94a3b8', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#1e293b',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
            }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                salinity: 'Dự báo',
                upper: 'Cận trên',
                lower: 'Cận dưới',
              };
              return [`${value}‰`, labels[name] || name];
            }}
          />
          {/* Confidence band */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="url(#confidenceGradient)"
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="transparent"
          />
          {/* Main prediction line */}
          <Area
            type="monotone"
            dataKey="salinity"
            stroke="#4A90D9"
            strokeWidth={2}
            fill="url(#salinityGradient)"
            dot={{ fill: '#4A90D9', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#22d3ee', stroke: '#4A90D9', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
