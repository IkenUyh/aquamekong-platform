import apiClient from './client';

/** Tình hình của trạm so với ngưỡng người dùng đặt */
export interface WatchOutlook {
  /** Số đo mới nhất, null khi không có hoặc đã cũ hơn 3 ngày */
  latestSalinity: number | null;
  latestAt: string | null;
  /** YYYY-MM-DD, ngày đầu tiên dự báo vượt ngưỡng; null = không vượt */
  firstExceedDate: string | null;
  forecastMax: number | null;
  exceeding: boolean;
}

export interface StationWatch {
  id: number;
  stationId: number;
  stationName: string;
  threshold: number;
  /** Loại cây đã chọn, null = tự đặt ngưỡng */
  crop: string | null;
  outlook: WatchOutlook;
}

export interface WatchRequest {
  stationId: number;
  threshold: number;
  crop: string | null;
}

export const watchApi = {
  list: () => apiClient.get<StationWatch[]>('/watches').then((r) => r.data),
  /** Theo dõi trạm, hoặc đổi ngưỡng nếu đã theo dõi */
  save: (req: WatchRequest) => apiClient.post<StationWatch>('/watches', req).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/watches/${id}`),
};
