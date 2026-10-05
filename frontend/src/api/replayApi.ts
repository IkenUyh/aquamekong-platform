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

export interface ReplayEvent {
  stationId: number;
  type: 'OPENED' | 'RESOLVED';
  value: number;
}

export interface ReplayDay {
  date: string;
  /** Cùng thứ tự với Replay.stations; null = không có số đo */
  salinity: (number | null)[];
  aboveCount: number;
  openCount: number;
  events: ReplayEvent[];
}

export interface Replay {
  from: string;
  to: string;
  defaultThreshold: number;
  stations: ReplayStation[];
  days: ReplayDay[];
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
