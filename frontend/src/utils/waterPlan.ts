import type { WaterDay, WaterDayStatus, WaterPlan, WaterStorage } from '../api/fieldApi';
import { formatDay, formatNumber } from './salinity';

/**
 * Lời và màu cho kế hoạch nước của một ruộng (backend WaterPlan). Giữ mọi logic ở đây để chế độ nông dân dùng lại.
 * Đỏ, vàng, xanh dành cho mức mặn; ngày chưa biết là xám.
 */

export const WATER_DAY_CHIP: Record<WaterDayStatus, string> = {
  SAFE: 'bg-green-50 border-green-200 text-green-900',
  RISK: 'bg-yellow-50 border-yellow-300 text-gray-900',
  EXCEED: 'bg-red-100 border-red-300 text-red-900',
  UNKNOWN: 'bg-gray-50 border-gray-200 text-gray-500',
};

/** Nhãn trạng thái ngày. Thuỷ sản cần khoảng mặn nên "vượt" là ra ngoài khoảng (quá mặn hoặc quá ngọt). */
export function waterDayLabel(status: WaterDayStatus, aquaculture = false): string {
  switch (status) {
    case 'SAFE': return aquaculture ? 'Trong khoảng nuôi' : 'Lấy được nước sông';
    case 'RISK': return 'Có thể mặn';
    case 'EXCEED': return aquaculture ? 'Ngoài khoảng nuôi' : 'Mặn, không lấy nước sông';
    default: return 'Chưa biết';
  }
}

const isUnsafe = (d: WaterDay) => d.status === 'EXCEED' || d.status === 'RISK';

/** Phân số đơn giản cho nông dân, làm tròn LÊN (thà pha nhiều nước ao hơn còn hơn tưới mặn) */
const FRACTIONS: Array<{ value: number; pond: number; river: number }> = [
  { value: 1 / 4, pond: 1, river: 3 },
  { value: 1 / 3, pond: 1, river: 2 },
  { value: 1 / 2, pond: 1, river: 1 },
  { value: 2 / 3, pond: 2, river: 1 },
  { value: 3 / 4, pond: 3, river: 1 },
];

/**
 * Phần nước ao làm tròn lên thành tỷ lệ "a phần nước ao, b phần nước sông".
 * null: không cần pha (0) hoặc phải tưới toàn nước ao (trên 3/4).
 */
export function simpleMix(fraction: number): { pond: number; river: number } | null {
  if (fraction <= 0) return null;
  const hit = FRACTIONS.find((f) => fraction <= f.value + 1e-9);
  return hit ? { pond: hit.pond, river: hit.river } : null;
}

/** "2 phần nước ao, 1 phần nước sông", "Chỉ tưới nước ao", "Tưới nước sông được" */
export function mixText(fraction: number | null): string | null {
  if (fraction == null) return null;
  if (fraction <= 0) return 'Tưới nước sông được';
  const mix = simpleMix(fraction);
  if (!mix) return 'Chỉ tưới nước ao, không pha nước sông';
  return `${mix.pond} phần nước ao, ${mix.river} phần nước sông`;
}

/** Ngày an toàn cuối trước ngày mặn đầu tiên (cùng quy tắc với backend WaterPlan.fillBy) */
export function fillByDate(days: WaterDay[]): string | null {
  let lastSafe: string | null = null;
  for (const d of days) {
    if (isUnsafe(d)) return lastSafe;
    if (d.status === 'SAFE') lastSafe = d.date;
  }
  return null;
}

/** Nhãn chip: "Hôm nay" cho ngày đầu, còn lại dd/MM */
export const chipDay = (d: WaterDay, index: number) => (index === 0 ? 'Hôm nay' : formatDay(d.date));

/**
 * Câu chính của kế hoạch: khi nào nước sông mặn và hạn chót lấy nước vào ao.
 * Thuỷ sản: khi nào độ mặn ra ngoài khoảng nuôi.
 */
export function planSummary(plan: WaterPlan, aquaculture = false): string {
  const days = plan.days;
  const total = days.length;
  const unsafe = days.filter(isUnsafe);
  if (days.every((d) => d.status === 'UNKNOWN')) {
    return 'Trạm mất tín hiệu hoặc chưa có dự báo, chưa biết ngày nào lấy được nước sông.';
  }
  if (unsafe.length === 0) {
    const unknown = days.filter((d) => d.status === 'UNKNOWN').length;
    const known = unknown > 0 ? ` (${unknown} ngày chưa có dự báo)` : '';
    return aquaculture
      ? `${total} ngày tới độ mặn ở trạm nằm trong khoảng nuôi${known}.`
      : `${total} ngày tới nước sông trong ngưỡng, lấy nước bình thường${known}.`;
  }
  const first = unsafe[0];
  const count = `${unsafe.length} trong ${total} ngày tới`;
  const what = aquaculture ? 'Độ mặn ở trạm ra ngoài khoảng nuôi' : 'Nước sông mặn';
  if (first.date === days[0].date) {
    return aquaculture
      ? `${what} từ hôm nay (${count}): không lấy nước sông vào ao nuôi.`
      : `${what} từ hôm nay (${count}): không lấy nước sông vào ao.`;
  }
  const fillBy = fillByDate(days);
  const deadline = fillBy ? `, lấy nước vào ao trước hết ngày ${formatDay(fillBy)}` : '';
  return `${what} từ ${formatDay(first.date)} (${count})${deadline}.`;
}

/** Ngày cần pha nhiều nước ao nhất: "Ngày mặn nhất (14/03): pha 2 phần nước ao, 1 phần nước sông" */
export function strongestMixLine(days: WaterDay[]): string | null {
  const unsafe = days.filter((d) => isUnsafe(d) && d.freshFraction != null && d.freshFraction > 0);
  if (unsafe.length === 0) return null;
  const worst = unsafe.reduce((a, b) => ((b.freshFraction ?? 0) > (a.freshFraction ?? 0) ? b : a));
  const text = mixText(worst.freshFraction);
  return `Ngày mặn nhất (${formatDay(worst.date)}): ${text?.charAt(0).toLowerCase()}${text?.slice(1)}`;
}

const m3 = (v: number) => `${formatNumber(Math.round(v), 0)} m³`;

/**
 * Nhu cầu nước và ao: "Cây cần khoảng 90 m³ nước mỗi ngày", rồi "Ao đủ cho 3 trong 5 ngày mặn, nếu pha thì đủ cả 5".
 */
export function storageLines(s: WaterStorage): string[] {
  const lines = [`Cây cần khoảng ${m3(s.dailyNeedM3)} nước mỗi ngày`];
  if (s.unsafeDays === 0) return lines;
  const n = s.unsafeDays;
  if (s.pondVolumeM3 == null) {
    lines.push(`Chưa khai ao trữ: cần trữ khoảng ${m3(s.extraNeededM3)} nước ngọt cho ${n} ngày mặn (đã tính pha)`);
    return lines;
  }
  if (s.pondDays >= n) {
    lines.push(`Ao ${m3(s.pondVolumeM3)} đủ cho cả ${n} ngày mặn`);
  } else if (s.pondDaysWithMix >= n) {
    lines.push(`Ao ${m3(s.pondVolumeM3)} đủ cho ${s.pondDays} trong ${n} ngày mặn, nếu pha thì đủ cả ${n}`);
  } else {
    const mixed = s.pondDaysWithMix > s.pondDays ? `, pha thì đủ ${s.pondDaysWithMix}` : '';
    lines.push(`Ao ${m3(s.pondVolumeM3)} đủ cho ${s.pondDays} trong ${n} ngày mặn${mixed}; cần trữ thêm khoảng ${m3(s.extraNeededM3)}`);
  }
  return lines;
}

/** Ghi chú cách tính, nhỏ dưới khối */
export function storageNote(s: WaterStorage, isRice: boolean): string {
  const from = s.et0Label ? ` (ET₀ ${s.et0Label})` : '';
  const base = `Theo FAO 56: Kc ${formatNumber(s.kc)} × ET₀ ${formatNumber(s.et0)} mm/ngày${from}.`;
  return isRice
    ? `${base} Với lúa đây là mức tối thiểu: chưa tính nước giữ mặt ruộng, nước thấm và thất thoát khi dẫn nước.`
    : base;
}
