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

/** Nhãn ngắn (marker, badge) */
export const SALINITY_CLASS_SHORT_LABELS: Record<SalinityClass, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  UNKNOWN: 'Chưa có dữ liệu',
};

/** Định dạng số đo kiểu Việt Nam (dấu phẩy thập phân), tối đa `digits` chữ số lẻ; null -> "—" */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  return value == null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: digits });
}

/** Nhãn + đơn vị của từng loại chỉ số đo */
export const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  salinity: { label: 'Độ mặn', unit: '‰' },
  water_level: { label: 'Mực nước', unit: 'm' },
  flow_rate: { label: 'Lưu lượng', unit: 'm³/s' },
};

export function metricLabel(metricType: string): { label: string; unit: string } {
  return METRIC_LABELS[metricType] ?? { label: metricType, unit: '' };
}

/** Trạm được coi là "đang truyền dữ liệu" nếu có số đo trong khoảng này (dữ liệu RYNAN về theo ngày) */
export const ONLINE_WINDOW_HOURS = 48;
export const ONLINE_WINDOW_MS = ONLINE_WINDOW_HOURS * 3600_000;

export function isReporting(lastMeasuredAt: string | null | undefined, now = Date.now()): boolean {
  return !!lastMeasuredAt && now - new Date(lastMeasuredAt).getTime() <= ONLINE_WINDOW_MS;
}
