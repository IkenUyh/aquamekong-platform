import React from 'react';

export type StatusLevel = 'CRITICAL' | 'WARNING' | 'INFO' | 'SAFE';

interface StatusBadgeProps {
  level: StatusLevel;
  text?: string;
  className?: string;
}

const DOT: Record<StatusLevel, string> = {
  CRITICAL: 'bg-red-500',
  WARNING: 'bg-yellow-500',
  INFO: 'bg-gray-400',
  SAFE: 'bg-green-500',
};

const TEXT: Record<StatusLevel, string> = {
  CRITICAL: 'text-red-700',
  WARNING: 'text-yellow-800',
  INFO: 'text-gray-600',
  SAFE: 'text-green-700',
};

const DEFAULT_LABELS: Record<StatusLevel, string> = {
  CRITICAL: 'Nguy hiểm',
  WARNING: 'Cảnh báo',
  INFO: 'Theo dõi',
  SAFE: 'Bình thường',
};

/** Chấm màu + chữ (không icon, không nền) — màu chỉ để phân biệt mức độ. */
export function StatusBadge({ level, text, className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${TEXT[level]} ${className}`}>
      <span className={`dot ${DOT[level]}`} />
      {text || DEFAULT_LABELS[level]}
    </span>
  );
}
