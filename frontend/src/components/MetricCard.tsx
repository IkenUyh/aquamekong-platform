import React from 'react';

export interface MetricCardProps {
  label?: string;
  title?: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color?: string;
  highlightColor?: string;
  delta?: number;
  deltaLabel?: string;
  deltaType?: 'percent' | 'absolute';
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
}

export function MetricCard({
  label, title, value, unit, icon, color, highlightColor, delta, deltaLabel, deltaType, subtitle, trend
}: MetricCardProps) {
  const cardTitle = label || title || '';
  const cardColor = color || highlightColor || 'text-gray-800';
  
  const hasTrend = trend !== undefined || delta !== undefined;
  const isPositive = trend ? trend.isPositive : (delta !== undefined && delta > 0);
  const deltaValue = trend ? trend.value : (delta !== undefined ? Math.abs(delta) : 0);
  const deltaColor = isPositive ? 'text-red-500' : 'text-green-500';
  const deltaIcon = isPositive ? '↑' : '↓';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs text-gray-500 font-medium line-clamp-1">{cardTitle}</span>
      </div>

      <p className={`text-xl font-bold ${cardColor}`}>
        {value}
        {unit && <span className="text-xs text-gray-400 ml-1 font-normal">{unit}</span>}
      </p>

      {subtitle && (
        <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{subtitle}</p>
      )}

      {hasTrend && (
        <p className={`text-[10px] mt-1.5 font-medium ${deltaColor}`}>
          {deltaIcon} {deltaValue}{deltaType === 'percent' || trend ? '%' : ''} {deltaLabel || ''}
        </p>
      )}
    </div>
  );
}
