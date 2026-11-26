import type { Crop } from '../api/cropApi';
import { fixedDays } from '../api/cropApi';

/** Một đoạn của thanh tiến độ vụ: ngày bắt đầu (tính từ 0 = ngày gieo) tới trước ngày kết thúc */
export interface StageSegment {
  code: string;
  name: string;
  start: number;
  end: number;
}

/**
 * Các giai đoạn trên trục ngày của vụ, cùng cách tính với backend CropStages: giai đoạn cố định giữ số ngày, giai đoạn
 * co giãn nhận phần còn lại của giống, giai đoạn chưa có mốc ngày (vd. mạ) dài 0 ngày nên không vẽ.
 * Trả mảng rỗng khi cây không chia giai đoạn hoặc thiếu số ngày của giống.
 */
export function stageSegments(crop: Crop, varietyDays: number | null): StageSegment[] {
  if (crop.stages.length < 2 || varietyDays == null) return [];
  const flexibleDays = Math.max(0, varietyDays - fixedDays(crop));
  const segments: StageSegment[] = [];
  let start = 0;
  for (const s of [...crop.stages].sort((a, b) => a.order - b.order)) {
    const length = s.durationDays ?? (s.flexible ? flexibleDays : 0);
    if (length > 0) segments.push({ code: s.code, name: s.name, start, end: start + length });
    start += length;
  }
  return segments;
}

/** Ngày của vụ hôm nay (ngày gieo là ngày 1), âm hoặc 0 khi chưa tới ngày gieo */
export function seasonDay(plantedOn: string, today: Date = new Date()): number {
  const [y, m, d] = plantedOn.split('-').map(Number);
  const planted = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - planted) / 86_400_000) + 1;
}
