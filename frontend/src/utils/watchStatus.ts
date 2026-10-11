import type { StationWatch } from '../api/watchApi';
import { formatDay, formatMeasuredAt, formatSalinity } from './salinity';

/** Một dòng tình hình: đang vượt, dự báo sẽ vượt, có nguy cơ vượt, hay dưới ngưỡng */
export function watchStatus(w: StationWatch): { text: string; exceeding: boolean } {
  const { latestSalinity, latestAt, firstExceedDate, forecastMax, firstRiskDate, riskMax, riskUntil } = w.outlook;
  if (latestSalinity != null && latestSalinity > w.threshold && latestAt) {
    return { text: `Đang vượt ngưỡng: ${formatSalinity(latestSalinity)}‰ ${formatMeasuredAt(latestAt)}`, exceeding: true };
  }
  if (firstExceedDate) {
    return { text: `Dự báo vượt ngưỡng từ ngày ${formatDay(firstExceedDate)}, cao nhất ${formatSalinity(forecastMax)}‰`, exceeding: true };
  }
  if (firstRiskDate) {
    return { text: `Có thể vượt ngưỡng từ ngày ${formatDay(firstRiskDate)} (có thể lên tới ${formatSalinity(riskMax)}‰)`, exceeding: true };
  }
  if (riskUntil) {
    // Lượt dự báo mới không còn thấy nguy cơ, nhưng đã báo có thể vượt tới ngày này: giữ cảnh báo tới hết ngày đó
    return { text: `Còn nguy cơ vượt ngưỡng tới hết ngày ${formatDay(riskUntil)}`, exceeding: true };
  }
  if (latestSalinity == null && forecastMax == null) return { text: 'Chưa có số đo gần đây', exceeding: false };
  const latest = latestSalinity != null ? `mới nhất ${formatSalinity(latestSalinity)}‰` : null;
  const peak = riskMax ?? forecastMax;
  const forecast = peak != null ? `${riskMax != null ? 'có thể lên tới' : 'dự báo cao nhất'} ${formatSalinity(peak)}‰` : null;
  return { text: `Dưới ngưỡng (${[latest, forecast].filter(Boolean).join(', ')})`, exceeding: false };
}
