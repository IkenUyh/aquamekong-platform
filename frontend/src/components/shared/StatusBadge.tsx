import React from 'react';
import { AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';

export type StatusLevel = 'CRITICAL' | 'WARNING' | 'INFO' | 'SAFE';

interface StatusBadgeProps {
  level: StatusLevel;
  text?: string;
  className?: string;
}

const STYLES = {
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  WARNING: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  INFO: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: <Info className="w-3.5 h-3.5" /> },
  SAFE: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', icon: <CheckCircle className="w-3.5 h-3.5" /> },
};

const DEFAULT_LABELS = {
  CRITICAL: 'Nguy hiểm',
  WARNING: 'Cảnh báo',
  INFO: 'Theo dõi',
  SAFE: 'Bình thường',
};

export function StatusBadge({ level, text, className = '' }: StatusBadgeProps) {
  const style = STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${style.bg} ${style.text} ${style.border} ${className}`}>
      {style.icon}
      {text || DEFAULT_LABELS[level]}
    </span>
  );
}
