import React from 'react';

interface SummaryCounterProps {
  count: number;
  label: string;
  /** Màu chấm mức độ, vd. 'bg-red-500' */
  dotClass: string;
}

export function SummaryCounter({ count, label, dotClass }: SummaryCounterProps) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <span className={`dot ${dotClass}`} />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 num">{count}</p>
    </div>
  );
}
