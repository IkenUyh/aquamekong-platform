import type { FieldExposure } from '../api/fieldApi';
import { formatDay, formatNumber, formatSalinity } from './salinity';

/** Từ mức giảm này trở lên thì tô đỏ (đỏ dành cho mức mặn gây hại) */
export const NOTABLE_YIELD_LOSS = 10;

export interface ExposureSummary {
  /** Câu chính: "Nếu tưới nước này, năng suất lúa có thể giảm khoảng 25%" */
  headline: string;
  /** Năng suất giảm đáng kể (≥ NOTABLE_YIELD_LOSS) */
  severe: boolean;
  /** Các dòng chi tiết: mùa, số ngày vượt, mặn cao nhất, mức tích lũy */
  details: string[];
}

const fullDay = (iso: string) => `${formatDay(iso)}/${iso.slice(0, 4)}`;

/** Mùa đang tính: "Vụ từ 01/11/2026, ngày 26/95" hoặc "Mùa khô 01/12/2025 – 31/05/2026" */
function seasonLine(e: FieldExposure): string {
  if (e.seasonKind === 'CROP_SEASON') {
    const done = e.computedThrough === e.seasonEnd;
    return done
      ? `Vụ ${fullDay(e.seasonStart)} – ${fullDay(e.seasonEnd)} (đã hết ${e.seasonDays} ngày của giống)`
      : `Vụ từ ${fullDay(e.seasonStart)}, ngày ${e.daysElapsed}/${e.seasonDays}`;
  }
  return `Mùa khô ${fullDay(e.seasonStart)} – ${fullDay(e.seasonEnd)}`;
}

/**
 * Lời cho khối "mức mặn cây đã chịu". cropName viết thường trong câu ("năng suất lúa").
 * Cây không có số FAO (sầu riêng, xoài, dừa) chỉ có số ngày vượt ngưỡng khuyến cáo, không có % năng suất.
 */
export function exposureSummary(e: FieldExposure, cropName: string): ExposureSummary {
  const crop = cropName.toLowerCase();
  const details = [seasonLine(e)];

  if (e.daysWithData === 0) {
    return { headline: 'Trạm chưa có số đo độ mặn trong mùa này', severe: false, details };
  }

  let headline: string;
  if (e.yieldLossPercent == null) {
    headline = e.daysExceeded > 0
      ? `Nước ở trạm đã vượt ngưỡng của ${crop} ${e.daysExceeded} ngày`
      : `Nước ở trạm chưa vượt ngưỡng của ${crop}`;
  } else if (e.yieldLossPercent === 0) {
    headline = e.daysExceeded > 0
      ? `Nếu tưới nước này, năng suất ${crop} giảm dưới 1%`
      : `Nếu tưới nước này, năng suất ${crop} chưa bị giảm`;
  } else {
    headline = `Nếu tưới nước này, năng suất ${crop} có thể giảm khoảng ${e.yieldLossPercent}%`;
  }

  const basis = e.thresholdBasis === 'FAO' ? 'mức năng suất bắt đầu giảm' : 'ngưỡng khuyến cáo';
  const counted = e.daysWithData < e.daysElapsed ? ` trong ${e.daysWithData}/${e.daysElapsed} ngày có số đo` : '';
  details.push(`Vượt ${formatSalinity(e.threshold)}‰ (${basis}) ${e.daysExceeded} ngày${counted}`);
  if (e.maxSalinity != null && e.maxOn) {
    details.push(`Mặn cao nhất ${formatSalinity(e.maxSalinity)}‰ ngày ${formatDay(e.maxOn)}`
      + (e.lastExceededOn ? `, lần vượt gần nhất ${formatDay(e.lastExceededOn)}` : ''));
  }
  if (e.daysExceeded > 0) {
    details.push(`Mặn tích lũy ${formatNumber(e.cumulative, 1)}‰·ngày, đã nhân hệ số nhạy của giai đoạn`);
  }

  return { headline, severe: (e.yieldLossPercent ?? 0) >= NOTABLE_YIELD_LOSS, details };
}
