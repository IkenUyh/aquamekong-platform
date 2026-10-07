import React from 'react';
import { formatNumber } from '../utils/salinity';

export interface MetricChange {
  /** Mức thay đổi so với kỳ trước */
  value: number;
  /** '%' = phần trăm, 'abs' = cùng đơn vị với giá trị */
  kind: '%' | 'abs';
  /** vd. "so với 24h trước" */
  label?: string;
  /** true: tăng là xấu (độ mặn) -> đỏ; mặc định trung tính */
  upIsBad?: boolean;
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Dòng chú thích nhỏ dưới số */
  hint?: string;
  change?: MetricChange;
  /** Nhấn mạnh con số (vd. số trạm vượt ngưỡng > 0) */
  tone?: 'default' | 'danger';
}

/** Thẻ chỉ số: nhãn -> số lớn -> chú thích/thay đổi. Không icon trang trí. */
export function MetricCard({ label, value, unit, hint, change, tone = 'default' }: MetricCardProps) {
  let changeText: string | null = null;
  let changeClass = 'text-gray-500';
  if (change) {
    const sign = change.value > 0 ? '+' : change.value < 0 ? '−' : '±';
    changeText = `${sign}${formatNumber(Math.abs(change.value), 1)}${change.kind === '%' ? '%' : unit ? ` ${unit}` : ''}`;
    if (change.upIsBad && change.value > 0) changeClass = 'text-red-600';
    else if (change.upIsBad && change.value < 0) changeClass = 'text-green-700';
  }

  return (
    <div className="card p-4 h-full">
      <p className="text-xs font-medium text-gray-500 line-clamp-2">{label}</p>
      <p className={`mt-1 text-2xl font-semibold num ${tone === 'danger' ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>}
      </p>
      {(changeText || hint) && (
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
          {changeText && <span className={`font-medium num ${changeClass}`}>{changeText}</span>}
          {changeText && change?.label && <span> {change.label}</span>}
          {changeText && hint && <span> · </span>}
          {hint}
        </p>
      )}
    </div>
  );
}
