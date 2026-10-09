import type { StationWatch } from '../api/watchApi';
import { formatDay, formatMeasuredAt, formatNumber } from './salinity';

/** Một dòng tình hình: đang vượt, dự báo sẽ vượt, hay dưới ngưỡng */
export function watchStatus(w: StationWatch): { text: string; exceeding: boolean } {
  const { latestSalinity, latestAt, firstExceedDate, forecastMax } = w.outlook;
  if (latestSalinity != null && latestSalinity > w.threshold && latestAt) {
    return { text: `Đang vượt ngưỡng: ${formatNumber(latestSalinity)}‰ ${formatMeasuredAt(latestAt)}`, exceeding: true };
  }
  if (firstExceedDate) {
    return { text: `Dự báo vượt ngưỡng từ ngày ${formatDay(firstExceedDate)}, cao nhất ${formatNumber(forecastMax)}‰`, exceeding: true };
  }
  if (latestSalinity == null && forecastMax == null) return { text: 'Chưa có số đo gần đây', exceeding: false };
  const latest = latestSalinity != null ? `mới nhất ${formatNumber(latestSalinity)}‰` : null;
  const forecast = forecastMax != null ? `dự báo cao nhất ${formatNumber(forecastMax)}‰` : null;
  return { text: `Dưới ngưỡng (${[latest, forecast].filter(Boolean).join(', ')})`, exceeding: false };
}
