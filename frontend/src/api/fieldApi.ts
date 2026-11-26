import apiClient from './client';
import type { WatchOutlook } from './watchApi';

export interface FieldStage {
  code: string;
  name: string;
  /** Ngày thứ mấy của vụ (ngày gieo là ngày 1), null khi không có ngày gieo */
  day: number | null;
  beforePlanting: boolean;
  pastHarvest: boolean;
}

/** Hồ sơ một ruộng của tài khoản */
export interface FieldProfile {
  id: number;
  name: string;
  /** null khi trạm đã bị xoá: cần chọn lại */
  stationId: number | null;
  stationName: string | null;
  cropCode: string;
  cropName: string;
  variety: string | null;
  varietyDays: number | null;
  /** YYYY-MM-DD, ngày gieo sạ / ngày trồng */
  plantedOn: string | null;
  areaHa: number | null;
  hasPond: boolean;
  pondVolumeM3: number | null;
  stage: FieldStage | null;
  /** Ngưỡng (‰) của cây ở giai đoạn hiện tại, null = loài chưa có nguồn */
  threshold: number | null;
  /** Cận dưới (‰) khi cần khoảng mặn (nuôi tôm) */
  minThreshold: number | null;
  /** Tình hình mặn của trạm so với ngưỡng ruộng, null khi không có trạm hoặc ngưỡng */
  outlook: WatchOutlook | null;
  /** Ruộng do tài khoản đang xem khai */
  mine: boolean;
  /** Người khai ruộng nhận thông báo đẩy (ruộng do khách khai thì không) */
  notified: boolean;
}

export interface FieldRequest {
  name: string;
  stationId: number;
  cropCode: string;
  variety: string | null;
  varietyDays: number | null;
  plantedOn: string | null;
  areaHa: number | null;
  hasPond: boolean;
  pondVolumeM3: number | null;
}

export const fieldApi = {
  list: () => apiClient.get<FieldProfile[]>('/fields').then((r) => r.data),
  create: (req: FieldRequest) => apiClient.post<FieldProfile>('/fields', req).then((r) => r.data),
  update: (id: number, req: FieldRequest) => apiClient.put<FieldProfile>(`/fields/${id}`, req).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/fields/${id}`),
};
