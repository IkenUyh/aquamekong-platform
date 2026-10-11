import apiClient from './client';

/** Khoảng ngày có dữ liệu độ mặn (yyyy-MM-dd) */
export interface ReplayBounds {
  minDate: string | null;
  maxDate: string | null;
}

export interface ReplayStation {
  id: number;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Ngưỡng rule cảnh báo độ mặn của trạm (‰) */
  threshold: number;
}

/**
 * OPENED/RESOLVED: value là độ mặn; OPENED có warnedDaysAhead = app đã cảnh báo sớm trước bao nhiêu ngày (null = không).
 * WARNED: cảnh báo sớm (mô hình rủi ro), value là mức có thể lên tới, expectedDate là ngày đầu tiên có thể vượt,
 * outcome HIT (vượt thật) | MISS (hết nguy cơ mà không vượt) | OPEN (chưa rõ), outcomeDate là ngày rõ kết quả.
 */
export interface ReplayEvent {
  stationId: number;
  type: 'OPENED' | 'RESOLVED' | 'WARNED';
  value: number;
  warnedDaysAhead: number | null;
  expectedDate: string | null;
  outcome: 'HIT' | 'MISS' | 'OPEN' | null;
  outcomeDate: string | null;
}

export interface ReplayDay {
  date: string;
  /** Cùng thứ tự với Replay.stations; null = không có số đo */
  salinity: (number | null)[];
  aboveCount: number;
  openCount: number;
  /** Số trạm đang có cảnh báo sớm (chưa có số đo vượt) */
  warningCount: number;
  events: ReplayEvent[];
}

/**
 * Cảnh báo sớm của giai đoạn, chỉ trong các mùa khô đã chạy lại mô hình rủi ro (mỗi mùa mô hình chỉ học số đo trước mùa đó).
 * available = false khi ML service chưa có kết quả.
 */
export interface ReplayEarlyWarning {
  available: boolean;
  seasons: { label: string; from: string; to: string }[];
  /** Số lần trạm bắt đầu vượt ngưỡng; warnedAhead: trong đó app đã cảnh báo sớm từ hôm trước */
  opened: number;
  warnedAhead: number;
  medianLeadDays: number | null;
  /** Số lần cảnh báo sớm: vượt thật (hits) / hết nguy cơ mà không vượt (misses) */
  warnings: number;
  hits: number;
  misses: number;
}

export interface Replay {
  from: string;
  to: string;
  defaultThreshold: number;
  stations: ReplayStation[];
  days: ReplayDay[];
  earlyWarning: ReplayEarlyWarning;
}

export interface DateRange {
  label: string;
  from: string;
  to: string;
}

/** Mùa khô ĐBSCL: 01/12 năm trước → 31/05, cắt theo khoảng có dữ liệu; mới nhất trước */
export function dryseasonPresets(bounds: ReplayBounds): DateRange[] {
  const { minDate, maxDate } = bounds;
  if (!minDate || !maxDate) return [];
  const presets: DateRange[] = [];
  for (let year = Number(maxDate.slice(0, 4)); year >= Number(minDate.slice(0, 4)); year--) {
    const from = `${year - 1}-12-01` < minDate ? minDate : `${year - 1}-12-01`;
    const to = `${year}-05-31` > maxDate ? maxDate : `${year}-05-31`;
    if (from <= to) presets.push({ label: `Mùa khô ${year - 1}–${year}`, from, to });
  }
  return presets;
}

export const replayApi = {
  getBounds: () => apiClient.get<ReplayBounds>('/reports/replay/bounds').then((r) => r.data),
  getReplay: (from: string, to: string) =>
    apiClient.get<Replay>('/reports/replay', { params: { from, to } }).then((r) => r.data),
};
