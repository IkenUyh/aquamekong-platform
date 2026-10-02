import type { Station } from '../types';
import { SALINITY_LOW_MAX, SALINITY_THRESHOLD } from './salinity';

/** Thang màu các lớp nhiệt trên bản đồ (dùng chung cho heatmap và chú giải). */
export type HeatMetric = 'salinity' | 'waterLevel' | 'flowRate';

interface HeatScale {
  label: string;
  unit: string;
  value: (s: Station) => number | null | undefined;
  /** Giá trị ứng với cường độ 1.0 */
  max: number;
  gradient: Record<number, string>;
}

const SALINITY_MAX = SALINITY_THRESHOLD * 2;

export const HEAT_SCALES: Record<HeatMetric, HeatScale> = {
  // Mốc màu khớp thang chung: < 1‰ xanh lá, 1–4‰ vàng, > 4‰ đỏ
  salinity: {
    label: 'Độ mặn', unit: '‰', value: (s) => s.latestSalinity, max: SALINITY_MAX,
    gradient: {
      0: '#22c55e',
      [SALINITY_LOW_MAX / SALINITY_MAX]: '#22c55e',
      [(SALINITY_LOW_MAX + 0.5) / SALINITY_MAX]: '#eab308',
      [SALINITY_THRESHOLD / SALINITY_MAX]: '#eab308',
      [(SALINITY_THRESHOLD + 0.5) / SALINITY_MAX]: '#ef4444',
      1: '#7f1d1d',
    },
  },
  waterLevel: {
    label: 'Mực nước', unit: 'm', value: (s) => s.latestWaterLevel, max: 3,
    gradient: { 0: '#bae6fd', 0.5: '#38bdf8', 1: '#1e3a8a' },
  },
  flowRate: {
    label: 'Lưu lượng', unit: 'm³/s', value: (s) => s.latestFlowRate, max: 6000,
    gradient: { 0: '#ccfbf1', 0.5: '#2dd4bf', 1: '#115e59' },
  },
};
