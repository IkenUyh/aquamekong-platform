import type { Station } from '../types';
import { classifySalinity, SALINITY_CLASS_COLORS, SALINITY_CLASS_LABELS, type SalinityClass } from './salinity';

/** Chỉ số dùng để tô màu marker trạm trên trang Bản đồ. */
export type ColorMetric = 'salinity' | 'waterLevel' | 'flowRate';

export interface ScaleBin {
  key: string;
  label: string;
  color: string;
}

export interface MetricScale {
  label: string;
  unit: string;
  /** Số chữ số lẻ khi hiện trên marker */
  digits: number;
  value: (s: Pick<Station, 'latestSalinity' | 'latestWaterLevel' | 'latestFlowRate'>) => number | null | undefined;
  /** Các mức theo thứ tự hiển thị trong chú giải (mức "chưa có dữ liệu" ở cuối) */
  bins: ScaleBin[];
  binOf: (value: number | null | undefined) => ScaleBin;
}

const NO_DATA: ScaleBin = { key: 'UNKNOWN', label: 'Chưa có dữ liệu', color: SALINITY_CLASS_COLORS.UNKNOWN };

/** Thang tuần tự theo ngưỡng tăng dần; đỏ, vàng, xanh lá để dành cho độ mặn nên dùng dải xanh dương */
function sequential(thresholds: number[], colors: string[], unit: string): Pick<MetricScale, 'bins' | 'binOf'> {
  const fmt = (n: number) => n.toLocaleString('vi-VN');
  const ranges: ScaleBin[] = colors.map((color, i) => {
    const label = i === 0 ? `< ${fmt(thresholds[0])} ${unit}`
      : i === thresholds.length ? `≥ ${fmt(thresholds[i - 1])} ${unit}`
      : `${fmt(thresholds[i - 1])} – ${fmt(thresholds[i])} ${unit}`;
    return { key: String(i), label, color };
  });
  return {
    bins: [...ranges].reverse().concat(NO_DATA),
    binOf: (v) => {
      if (v == null) return NO_DATA;
      const i = thresholds.findIndex((t) => v < t);
      return ranges[i === -1 ? ranges.length - 1 : i];
    },
  };
}

const SALINITY_ORDER: SalinityClass[] = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
const salinityBin = (c: SalinityClass): ScaleBin => ({ key: c, label: SALINITY_CLASS_LABELS[c], color: SALINITY_CLASS_COLORS[c] });

export const METRIC_SCALES: Record<ColorMetric, MetricScale> = {
  // Cùng thang với cả app (utils/salinity): < 1‰ xanh lá, 1–4‰ vàng, > 4‰ đỏ
  salinity: {
    label: 'Độ mặn', unit: '‰', digits: 1, value: (s) => s.latestSalinity,
    bins: SALINITY_ORDER.map(salinityBin),
    binOf: (v) => salinityBin(classifySalinity(v)),
  },
  // Mốc theo phân bố số đo RYNAN (phần lớn 0,5 – 2,1 m)
  waterLevel: {
    label: 'Mực nước', unit: 'm', digits: 2, value: (s) => s.latestWaterLevel,
    ...sequential([0.5, 1, 1.5, 2], ['#e0f2fe', '#7dd3fc', '#38bdf8', '#0284c7', '#0c4a6e'], 'm'),
  },
  // Lưu lượng thượng nguồn (GloFAS) tại vị trí trạm: chênh nhau hàng trăm lần nên chia theo bậc
  flowRate: {
    label: 'Lưu lượng', unit: 'm³/s', digits: 1, value: (s) => s.latestFlowRate,
    ...sequential([1, 10, 50, 100], ['#ccfbf1', '#5eead4', '#14b8a6', '#0f766e', '#134e4a'], 'm³/s'),
  },
};

export const COLOR_METRICS: ColorMetric[] = ['salinity', 'waterLevel', 'flowRate'];
