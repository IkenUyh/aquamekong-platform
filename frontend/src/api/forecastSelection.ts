import type { SalinityForecast } from '../types';

/** Ngày theo giờ máy người dùng, dạng yyyy-MM-dd (cùng định dạng LocalDate của backend) */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

/**
 * Lượt dự báo mới nhất đã lưu có dùng được không.
 * - Dự báo tính từ hôm nay (Prophet, thống kê...): phải chạy hôm nay và phủ tới hôm nay + daysAhead.
 * - ST-GNN tính từ ngày dữ liệu cuối (dataUntil, có thể đã qua): phải chạy hôm nay và phủ tới
 *   dataUntil + daysAhead. ST-GNN chỉ có vài mốc (vd. +1, +7), nên không đòi đủ từng ngày.
 * Trả về các dự báo nên hiển thị, hoặc null nếu cần chạy lại mô hình.
 */
export function usableForecasts(latestRun: SalinityForecast[], daysAhead: number, now = new Date()): SalinityForecast[] | null {
  if (latestRun.length === 0) return null;
  const today = isoDate(now);
  const sorted = [...latestRun].sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));
  const anchor = sorted[0].dataUntil ?? today;
  const ranToday = !!sorted[0].runAt && isoDate(new Date(sorted[0].runAt)) === today;
  const covers = sorted[sorted.length - 1].forecastDate >= addDays(anchor, daysAhead);

  if (sorted[0].dataUntil) {
    return ranToday && covers ? sorted.filter((f) => f.forecastDate <= addDays(anchor, daysAhead)) : null;
  }
  // Quy tắc cũ: đủ daysAhead ngày bắt đầu từ ngày mai
  const fromTomorrow = sorted.filter((f) => f.forecastDate > today);
  return fromTomorrow.length >= daysAhead && fromTomorrow[0].forecastDate === addDays(today, 1)
    ? fromTomorrow.slice(0, daysAhead)
    : null;
}

/** Người chưa đăng nhập không chạy được mô hình: hiện lượt đã lưu, bỏ các ngày đã qua nếu không phải ST-GNN */
export function storedForecasts(latestRun: SalinityForecast[], daysAhead: number, now = new Date()): SalinityForecast[] {
  const today = isoDate(now);
  const sorted = [...latestRun].sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));
  return (sorted[0]?.dataUntil ? sorted : sorted.filter((f) => f.forecastDate > today)).slice(0, daysAhead);
}
