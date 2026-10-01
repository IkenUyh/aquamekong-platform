/**
 * Thang độ mặn dùng chung toàn app — khớp với backend StationService.classifySalinity:
 * LOW < 1‰ ≤ MEDIUM ≤ 4‰ < HIGH.
 */
export const SALINITY_THRESHOLD = 4;
export const SALINITY_LOW_MAX = 1;

export type SalinityClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export function classifySalinity(value: number | null | undefined): SalinityClass {
  if (value == null) return 'UNKNOWN';
  if (value < SALINITY_LOW_MAX) return 'LOW';
  if (value <= SALINITY_THRESHOLD) return 'MEDIUM';
  return 'HIGH';
}

export const SALINITY_CLASS_COLORS: Record<SalinityClass, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#ef4444',
  UNKNOWN: '#94a3b8',
};

export const SALINITY_CLASS_LABELS: Record<SalinityClass, string> = {
  LOW: 'Thấp (< 1‰)',
  MEDIUM: 'Trung bình (1 – 4‰)',
  HIGH: 'Cao (> 4‰)',
  UNKNOWN: 'Chưa có dữ liệu',
};

/** Định dạng số đo kiểu Việt Nam (dấu phẩy thập phân), tối đa `digits` chữ số lẻ; null -> "—" */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  return value == null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: digits });
}
