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

export const accuracyApi = {
  get: (days = 180) => apiClient.get<ForecastAccuracy>('/forecasts/accuracy', { params: { days } }).then((r) => r.data),
  verification: (stationId: number, days = 30) =>
    apiClient.get<VerificationPoint[]>(`/forecasts/station/${stationId}/verification`, { params: { days } }).then((r) => r.data),
};

/** % mô hình tốt hơn giữ nguyên số mới nhất (âm = kém hơn), làm tròn */
export function skillPercent(a: LeadAccuracy): number {
  if (a.persistenceMae === 0) return 0;
  return Math.round((100 * (a.persistenceMae - a.mae)) / a.persistenceMae);
}
