import type { StationWatch } from '../api/watchApi';
import { formatDay, formatMeasuredAt, formatSalinity } from './salinity';

/**
 * Một dòng tình hình: đang vượt, dự báo sẽ vượt, có nguy cơ vượt, hay dưới ngưỡng. Theo dõi có cận dưới (nuôi tôm)
 * thì báo cả khi mặn xuống dưới mức tối thiểu, và lúc bình thường ghi "Trong khoảng".
 */
export function watchStatus(w: StationWatch): { text: string; exceeding: boolean } {
  const { latestSalinity, latestAt, firstExceedDate, forecastMax, firstRiskDate, riskMax, riskUntil, firstBelowDate, forecastMin } = w.outlook;
  const min = w.minThreshold;
  if (latestSalinity != null && latestSalinity > w.threshold && latestAt) {
    return { text: `Đang vượt ngưỡng: ${formatSalinity(latestSalinity)}‰ ${formatMeasuredAt(latestAt)}`, exceeding: true };
  }
  if (min != null && latestSalinity != null && latestSalinity < min && latestAt) {
    return { text: `Dưới mức tối thiểu: ${formatSalinity(latestSalinity)}‰ ${formatMeasuredAt(latestAt)}`, exceeding: true };
  }
  if (min != null && firstBelowDate) {
    return { text: `Dự báo xuống dưới mức tối thiểu từ ngày ${formatDay(firstBelowDate)}, thấp nhất ${formatSalinity(forecastMin)}‰`, exceeding: true };
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
  return { text: `${min != null ? 'Trong khoảng' : 'Dưới ngưỡng'} (${[latest, forecast].filter(Boolean).join(', ')})`, exceeding: false };
}
