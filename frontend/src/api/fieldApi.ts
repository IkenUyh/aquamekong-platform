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
  /** Năng suất bình thường người dùng nhập (tấn/ha), null = dùng mặc định của cây */
  yieldTHa: number | null;
  /** Giá bán người dùng nhập (đồng/kg), null = dùng mặc định của cây */
  priceVndKg: number | null;
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

/**
 * Mức mặn cây đã chịu trong mùa nếu tưới bằng nước ở trạm của ruộng (backend SalinityExposure).
 * Ngày là YYYY-MM-DD; độ mặn tính bằng ‰.
 */
export interface FieldExposure {
  /** CROP_SEASON: từ ngày gieo tới hết số ngày của giống; DRY_SEASON: mùa khô 01/12 – 31/05 */
  seasonKind: 'CROP_SEASON' | 'DRY_SEASON';
  seasonStart: string;
  seasonEnd: string;
  /** Ngày cuối đã tính: hôm nay, hoặc ngày cuối mùa nếu mùa đã qua */
  computedThrough: string;
  seasonDays: number;
  daysElapsed: number;
  daysWithData: number;
  daysExceeded: number;
  maxSalinity: number | null;
  maxOn: string | null;
  lastExceededOn: string | null;
  threshold: number | null;
  /** FAO: mức năng suất còn 100% (FAO 29); STAGE: ngưỡng khuyến cáo của giai đoạn (cây không có số FAO) */
  thresholdBasis: 'FAO' | 'STAGE';
  /** Σ (mặn − ngưỡng) × hệ số nhạy của giai đoạn, ‰·ngày */
  cumulative: number;
  effectiveSalinity: number | null;
  /** % năng suất có thể giảm, null khi cây không có số FAO hoặc chưa có số đo */
  yieldLossPercent: number | null;
  faoSource: string | null;
  /** Thiệt hại ước tính ra tiền, null khi không có % năng suất giảm */
  damage: FieldDamage | null;
}

/**
 * Thiệt hại = diện tích × % giảm năng suất × năng suất bình thường × giá bán (số ước tính).
 * Số nào chưa có thì null, kéo theo các khoản tiền null.
 */
export interface FieldDamage {
  areaHa: number | null;
  yieldTHa: number | null;
  /** Năng suất lấy mặc định của cây */
  yieldDefault: boolean;
  priceVndKg: number | null;
  priceDefault: boolean;
  /** Ngày lấy giá mặc định, null khi người dùng tự nhập giá */
  priceAsOf: string | null;
  seasonValueVnd: number | null;
  perPercentVnd: number | null;
  lossVnd: number | null;
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
  yieldTHa: number | null;
  priceVndKg: number | null;
}

export const fieldApi = {
  list: () => apiClient.get<FieldProfile[]>('/fields').then((r) => r.data),
  create: (req: FieldRequest) => apiClient.post<FieldProfile>('/fields', req).then((r) => r.data),
  update: (id: number, req: FieldRequest) => apiClient.put<FieldProfile>(`/fields/${id}`, req).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/fields/${id}`),
  /** null (204) khi không tính được: không có trạm, không phải cây trồng, chưa gieo, hoặc chưa có ngưỡng */
  exposure: (id: number) => apiClient.get<FieldExposure | ''>(`/fields/${id}/exposure`)
    .then((r) => (r.status === 204 || !r.data ? null : r.data)),
};
