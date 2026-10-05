import React from 'react';

interface MetricCompareCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export function MetricCompareCard({ label, value, icon, trend }: MetricCompareCardProps) {
  let valueColor = 'text-gray-800';
  if (trend === 'up') valueColor = 'text-red-500';
  if (trend === 'down') valueColor = 'text-green-500';

  return (
    <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 flex flex-col justify-center">
      <div className="flex items-center gap-1 mb-1 text-gray-500">
        {icon && <span className="text-gray-400 w-4 h-4 flex items-center justify-center">{icon}</span>}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`text-lg font-semibold num ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
