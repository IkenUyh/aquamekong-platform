import type { Crop } from '../api/cropApi';
import { formatNumber } from './salinity';

/** Một mức gợi ý cho ô chọn loại cây: một cây, hoặc một giai đoạn của cây chia giai đoạn (lúa) */
export interface WatchPreset {
  /** "lua:lam_dong_tro", "sau_rieng:ca_nam" */
  key: string;
  label: string;
  /** Tên lưu vào theo dõi (station_watches.crop, tối đa 30 ký tự) */
  crop: string;
  threshold: number;
  minThreshold: number | null;
  source: string | null;
  note: string | null;
  /** Giai đoạn chính của cây (giai đoạn co giãn theo giống, vd. lúa đẻ nhánh) */
  main: boolean;
}

/** Mức chọn sẵn: giai đoạn chính của cây đầu bảng (lúa đẻ nhánh), không phải mạ chưa có mốc ngày */
export function defaultPreset(presets: WatchPreset[]): WatchPreset | undefined {
  return presets.find((p) => p.main) ?? presets[0];
}

/** Giá trị của lựa chọn "Tự đặt ngưỡng" */
export const CUSTOM_PRESET = '';

function limitText(max: number, min: number | null): string {
  return min == null ? `${formatNumber(max)}‰` : `${formatNumber(min)}–${formatNumber(max)}‰`;
}

/** Mức gợi ý từ bảng crops; giai đoạn chưa có ngưỡng thì bỏ */
export function watchPresets(crops: Crop[]): WatchPreset[] {
  return crops.flatMap((c) => c.stages
    .filter((s) => s.maxSalinity != null)
    .map((s) => ({
      key: `${c.code}:${s.code}`,
      label: `${c.stages.length > 1 ? `${c.name} – ${s.name.toLowerCase()}` : c.name} (${limitText(s.maxSalinity!, s.minSalinity)})`,
      crop: c.name.slice(0, 30),
      threshold: s.maxSalinity!,
      minThreshold: s.minSalinity,
      source: s.thresholdSource,
      note: s.thresholdNote,
      main: s.flexible,
    })));
}

/** Mức gợi ý khớp với theo dõi đã lưu (cùng cây, cùng ngưỡng), để mở lại form đúng lựa chọn */
export function presetFor(presets: WatchPreset[], crop: string | null, threshold: number, minThreshold: number | null): WatchPreset | undefined {
  if (crop == null) return undefined;
  return presets.find((p) => p.crop === crop && p.threshold === threshold && p.minThreshold === minThreshold)
    ?? presets.find((p) => p.crop === crop);
}

/** Tên các cây có ngưỡng này (viết thường), vd. "lúa, nuôi tôm sú" cho nhãn ngưỡng của thẻ cảnh báo sớm */
export function cropsAtThreshold(crops: Crop[], threshold: number): string[] {
  return crops.filter((c) => c.stages.some((s) => s.maxSalinity === threshold)).map((c) => c.name.toLowerCase());
}
