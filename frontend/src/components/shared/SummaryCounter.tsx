import React from 'react';

interface SummaryCounterProps {
  count: number;
  label: string;
  colorClass: string; // e.g., 'text-red-500'
  icon: React.ReactNode;
}

export function SummaryCounter({ count, label, colorClass, icon }: SummaryCounterProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col items-center justify-center text-center gap-2">
      <div className={`flex items-center gap-2 text-2xl font-bold ${colorClass}`}>
        {icon}
        {count}
      </div>
      <div className="text-xs text-gray-500 font-medium">
        {label}
      </div>
    </div>
  );
}
