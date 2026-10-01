import apiClient, { withFallback } from './client';
import { MOCK_REPORT_OVERVIEW, MOCK_TOP_STATIONS, MOCK_TREND_DATA } from '../data/mockData';

/** Trung bình kỳ hiện tại và kỳ liền trước; null = chưa có dữ liệu */
export interface PeriodValue {
  current: number | null;
  previous: number | null;
}

export interface ReportOverview {
  days: number;
  avgSalinity: PeriodValue;
  avgWaterLevel: PeriodValue;
  avgFlowRate: PeriodValue;
  stationsAboveThreshold: number;
  totalStations: number;
  salinityThreshold: number;
  levelDistribution: { level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'; label: string; count: number }[];
}

export interface TrendPoint {
  date: string;
  current: number | null;
  previous: number | null;
}

export interface TopStation {
  rank: number;
  stationId: number;
  name: string;
  province?: string;
  salinity: number | null;
  previous: number | null;
  diff: number | null;
}

/** % thay đổi so với kỳ trước (null nếu thiếu dữ liệu) */
export function percentChange(v: PeriodValue): number | null {
  if (v.current == null || v.previous == null || v.previous === 0) return null;
  return Math.round(((v.current - v.previous) / Math.abs(v.previous)) * 1000) / 10;
}

export const reportApi = {
  getOverview: (days: number) =>
    withFallback(
      apiClient.get<ReportOverview>('/reports/overview', { params: { days } }).then((r) => r.data),
      MOCK_REPORT_OVERVIEW
    ),

  getTrend: (days: number) =>
    withFallback(
      apiClient.get<TrendPoint[]>('/reports/trend', { params: { days } }).then((r) => r.data),
      MOCK_TREND_DATA
    ),

  getTopStations: (days: number, limit = 5) =>
    withFallback(
      apiClient.get<TopStation[]>('/reports/top-stations', { params: { days, limit } }).then((r) => r.data),
      MOCK_TOP_STATIONS
    ),
};
