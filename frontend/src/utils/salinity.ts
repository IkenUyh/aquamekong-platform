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
/** fixed: luôn đủ số chữ số thập phân (chỉ số trung bình: "1,00" chứ không phải "1") */
export function formatNumber(value: number | null | undefined, digits = 2, fixed = false): string {
  return value == null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: fixed ? digits : 0 });
}

/** Sông mặc định ml-service gán khi nạp trạm không có thông tin sông (ingest/stations.py DEFAULT_RIVER) */
const UNCLASSIFIED_RIVER = 'Chưa phân loại';

/** Tên sông của trạm, bỏ sông mặc định "Chưa phân loại" (không mang thông tin) */
export const riverOf = (station: { riverName?: string | null }) =>
  station.riverName && station.riverName !== UNCLASSIFIED_RIVER ? station.riverName : undefined;

/** Nhãn + đơn vị của từng loại chỉ số đo */
export const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  salinity: { label: 'Độ mặn', unit: '‰' },
  water_level: { label: 'Mực nước', unit: 'm' },
  flow_rate: { label: 'Lưu lượng', unit: 'm³/s' },
};

export function metricLabel(metricType: string): { label: string; unit: string } {
  return METRIC_LABELS[metricType] ?? { label: metricType, unit: '' };
}

/**
 * Trạm được coi là "đang truyền dữ liệu" nếu có số đo trong khoảng này. Số liệu RYNAN theo ngày ghi lúc 00:00
 * của ngày đó và về sáng hôm sau (06:00), nên số mới nhất bình thường đã cũ tới ~54 giờ.
 */
export const ONLINE_WINDOW_HOURS = 72;
export const ONLINE_WINDOW_MS = ONLINE_WINDOW_HOURS * 3600_000;

/**
 * Thời điểm đo để hiển thị. Số liệu RYNAN theo ngày ghi lúc 00:00 (giờ không mang thông tin): "ngày 07/10";
 * số đo có giờ thật: "lúc 14:30, 07/10". prefix=false bỏ chữ "ngày"/"lúc" (cột bảng).
 */
export function formatMeasuredAt(iso: string, prefix = true): string {
  const d = new Date(iso);
  const daily = d.getHours() === 0 && d.getMinutes() === 0;
  const text = daily
    ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  return prefix ? `${daily ? 'ngày' : 'lúc'} ${text}` : text;
}

export function isReporting(lastMeasuredAt: string | null | undefined, now = Date.now()): boolean {
  return !!lastMeasuredAt && now - new Date(lastMeasuredAt).getTime() <= ONLINE_WINDOW_MS;
}
