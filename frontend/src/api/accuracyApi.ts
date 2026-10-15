import apiClient from './client';

/** Sai số theo số ngày dự báo trước (lead), từ backtest của ML service */
export interface LeadAccuracy {
  lead: number;
  count: number;
  /** Sai số tuyệt đối trung bình của mô hình (‰) */
  mae: number;
  /** Sai số nếu chỉ giữ nguyên số đo mới nhất (‰) */
  persistenceMae: number;
  /** Tỉ lệ đoán đúng mức mặn (thấp < 1‰, trung bình 1–4‰, cao > 4‰) */
  levelAccuracy: number;
}

export interface StationAccuracy {
  stationId: number;
  byLead: LeadAccuracy[];
  /** 90 ngày gần nhất: số đo thật và dự báo làm trước seriesLead ngày */
  series: { date: string; actual: number; predicted: number }[];
}

/** GET /forecasts/accuracy: chạy lại mô hình đang dùng trên các ngày đã qua */
export interface ForecastAccuracy {
  modelVersion: string;
  from: string;
  to: string;
  seriesLead: number;
  byLead: LeadAccuracy[];
  stations: StationAccuracy[];
}

/** GET /forecasts/station/{id}/verification: dự báo đã lưu đặt cạnh số đo thật */
export interface VerificationPoint {
  forecastDate: string;
  issuedOn: string;
  leadDays: number;
  predicted: number;
  actual: number;
  modelVersion: string;
}

/** Điểm cảnh báo sớm của một ngưỡng trong một mùa khô (mô phỏng đúng cách app báo người theo dõi trạm) */
export interface EarlyWarningScore {
  threshold: number;
  /** Số lần trạm bắt đầu vượt ngưỡng */
  onsets: number;
  /** Số lần trong đó app đang cảnh báo từ hôm trước (người dùng không bị bất ngờ); giữ nguyên số mới nhất: 0 */
  covered: number;
  /** Số lần app báo sớm nhắm đúng lần vượt đó (báo khi số đo còn dưới ngưỡng) */
  warnedAhead: number;
  medianLeadDays: number | null;
  /** Số lần báo sớm (số đo còn dưới ngưỡng), đúng (vượt thật) / nhầm (hết nguy cơ mà không vượt) */
  warnings: number;
  hits: number;
  misses: number;
}

/** Sai số của số dự báo app hiển thị so với giữ nguyên số mới nhất, ở các trạm đủ lịch sử của một mùa khô */
export interface SeasonForecastScore {
  stations: number;
  byLead: { lead: number; count: number; mae: number; persistenceMae: number }[];
}

export interface EarlyWarningSeason {
  label: string;
  from: string;
  to: string;
  /** Mô hình của mùa chỉ học số đo tới ngày này */
  trainedUntil: string;
  stations: number;
  /** Khoảng phân vị 20%–80% chứa số thật bao nhiêu phần (lý thuyết 60%) */
  coverage: number | null;
  /** Số thật vượt mức có thể lên tới bao nhiêu phần (lý thuyết 20%) */
  aboveUpper: number | null;
  thresholds: EarlyWarningScore[];
  forecast?: SeasonForecastScore;
}

/** Trạm có số đo từ ít nhất matureDays ngày: số dự báo mốc fromLead..toLead ngày là trung vị của mô hình */
export interface ForecastRule {
  fromLead: number;
  toLead: number;
  matureDays: number;
  stationIds: number[];
}

/** GET /forecasts/early-warning: mô hình rủi ro chạy lại trên từng mùa khô cũ */
export interface EarlyWarningEvaluation {
  modelVersion: string;
  trainedAt: string;
  trainedUntil: string;
  upperQuantile: number;
  warningHorizon: number;
  forecastRule?: ForecastRule;
  seasons: EarlyWarningSeason[];
}

export const accuracyApi = {
  get: (days = 180) => apiClient.get<ForecastAccuracy>('/forecasts/accuracy', { params: { days } }).then((r) => r.data),
  earlyWarning: () => apiClient.get<EarlyWarningEvaluation>('/forecasts/early-warning').then((r) => r.data),
  verification: (stationId: number, days = 30) =>
    apiClient.get<VerificationPoint[]>(`/forecasts/station/${stationId}/verification`, { params: { days } }).then((r) => r.data),
};

/** % mô hình tốt hơn giữ nguyên số mới nhất (âm = kém hơn), làm tròn */
export function skillPercent(a: LeadAccuracy): number {
  if (a.persistenceMae === 0) return 0;
  return Math.round((100 * (a.persistenceMae - a.mae)) / a.persistenceMae);
}
