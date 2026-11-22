import apiClient from './client';

/** Tình hình của trạm so với ngưỡng người dùng đặt, trong 7 ngày tới */
export interface WatchOutlook {
  /** Số đo mới nhất, null khi không có hoặc đã cũ hơn 3 ngày */
  latestSalinity: number | null;
  latestAt: string | null;
  /** YYYY-MM-DD, ngày đầu tiên dự báo vượt ngưỡng; null = không vượt */
  firstExceedDate: string | null;
  forecastMax: number | null;
  /** YYYY-MM-DD, ngày đầu tiên mức có thể lên tới (mô hình rủi ro) vượt ngưỡng; null = không */
  firstRiskDate: string | null;
  riskMax: number | null;
  /** YYYY-MM-DD, cảnh báo nguy cơ giữ tới hết ngày này (đã từng báo có thể vượt ngày đó) */
  riskUntil: string | null;
  /** Ra ngoài ngưỡng: vượt ngưỡng trên, có nguy cơ vượt, hoặc xuống dưới cận dưới (khi có) */
  exceeding: boolean;
  /** YYYY-MM-DD, ngày đầu tiên dự báo xuống dưới cận dưới; null = không có cận dưới hoặc không xuống dưới */
  firstBelowDate: string | null;
  forecastMin: number | null;
}

export interface StationWatch {
  id: number;
  stationId: number;
  stationName: string;
  threshold: number;
  /** Cận dưới (‰) cho mức cần khoảng mặn như nuôi tôm, null = không có */
  minThreshold: number | null;
  /** Loại cây đã chọn, null = tự đặt ngưỡng */
  crop: string | null;
  /** Hồ sơ ruộng đã tạo theo dõi này (ngưỡng theo cây và giai đoạn), null = đặt tay */
  fieldProfileId: number | null;
  fieldName: string | null;
  outlook: WatchOutlook;
}

export interface WatchRequest {
  stationId: number;
  threshold: number;
  crop: string | null;
  /** Phải nhỏ hơn threshold; bỏ trống = không có cận dưới */
  minThreshold?: number | null;
}

export const watchApi = {
  list: () => apiClient.get<StationWatch[]>('/watches').then((r) => r.data),
  /** Theo dõi trạm, hoặc đổi ngưỡng nếu đã theo dõi */
  save: (req: WatchRequest) => apiClient.post<StationWatch>('/watches', req).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/watches/${id}`),
};
