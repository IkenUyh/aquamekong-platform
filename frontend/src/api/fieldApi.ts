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

export type WaterDayStatus = 'SAFE' | 'RISK' | 'EXCEED' | 'UNKNOWN';

/** Một ngày của kế hoạch nước (backend WaterPlan): độ mặn cao nhất ngày đó ở trạm so với ngưỡng của giai đoạn cây */
export interface WaterDay {
  /** YYYY-MM-DD */
  date: string;
  /**
   * SAFE: lấy được nước sông; RISK: dự báo trong ngưỡng nhưng mức có thể lên tới vượt; EXCEED: vượt ngưỡng (thuỷ sản:
   * ra ngoài khoảng); UNKNOWN: trạm mất tín hiệu hoặc không có dự báo ngày đó
   */
  status: WaterDayStatus;
  salinity: number | null;
  riskSalinity: number | null;
  /** salinity là số đo (chỉ hôm nay), không phải dự báo */
  measured: boolean;
  threshold: number | null;
  minThreshold: number | null;
  /** Phần nước ao trong hỗn hợp tưới (0 – 1), null với thuỷ sản hoặc khi không biết độ mặn */
  freshFraction: number | null;
}

/** Nước trữ trong ao so với nhu cầu của cây trong các ngày mặn (FAO 56: Kc × ET₀) */
export interface WaterStorage {
  /** m³ nước cây cần mỗi ngày, ở ngày mặn đầu tiên (không có thì hôm nay) */
  dailyNeedM3: number;
  kc: number;
  /** mm/ngày */
  et0: number;
  kcSource: string | null;
  et0Source: string | null;
  /** Cụm ngắn: ET₀ đó lấy từ đâu (trạm Cần Thơ, hay ước lượng thô của FAO cho mùa mưa) */
  et0Label: string | null;
  unsafeDays: number;
  /** null khi ruộng không có ao */
  pondVolumeM3: number | null;
  /** Số ngày mặn ao đủ nếu chỉ tưới nước ao */
  pondDays: number;
  /** Số ngày mặn ao đủ nếu pha nước ao với nước sông */
  pondDaysWithMix: number;
  /** YYYY-MM-DD, ngày cuối còn lấy được nước sông vào ao; null khi hôm nay đã mặn hoặc không có ngày mặn */
  fillBy: string | null;
  /** m³ cần trữ thêm để đủ mọi ngày mặn khi pha */
  extraNeededM3: number;
}

/** Kế hoạch nước hôm nay + 7 ngày của một ruộng */
export interface WaterPlan {
  days: WaterDay[];
  /** null khi không tính được lượng nước: không phải cây trồng, cây chưa có Kc, ruộng chưa nhập diện tích */
  storage: WaterStorage | null;
  /** Độ mặn nước ao app giả định (‰), hiện là 0 */
  pondSalinityAssumed: number;
}

/** RED: hôm nay vượt; YELLOW: hôm nay chưa vượt nhưng tuần này có ngày mặn; GREEN: cả tuần an toàn; GREY: chưa biết */
export type PlanVerdict = 'RED' | 'YELLOW' | 'GREEN' | 'GREY';

/**
 * Một việc cần làm (backend ActionPlan). kind của kế hoạch nước: STORE, MIX, POND_ONLY, STOP_INTAKE, CHECK, POND_EMPTY,
 * STAGE_CHANGE, TAKE_WATER; nguồn khác (bón phân) thêm loại riêng nên để string.
 */
export interface PlanAction {
  kind: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  /** YYYY-MM-DD */
  from: string;
  until: string;
  /** Phần nước ao đã làm tròn (MIX 1/4 – 3/4, POND_ONLY 1), null với loại khác */
  fraction: number | null;
  message: string;
  /** WATER (kế hoạch nước), FERTILIZER (bón phân) */
  source: string;
}

/** Kế hoạch việc cần làm của một ruộng, với câu trả lời "Tuần này lấy nước được không?" */
export interface FieldPlan {
  verdict: PlanVerdict;
  headline: string;
  /** Theo ngày, "Lấy nước được" ở cuối */
  actions: PlanAction[];
  waterPlan: WaterPlan;
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
  /** null (204) khi ruộng không có trạm hoặc giai đoạn cây hôm nay không có ngưỡng */
  waterPlan: (id: number) => apiClient.get<WaterPlan | ''>(`/fields/${id}/water-plan`)
    .then((r) => (r.status === 204 || !r.data ? null : r.data)),
  /** null (204) khi không lập được kế hoạch (như waterPlan) */
  plan: (id: number) => apiClient.get<FieldPlan | ''>(`/fields/${id}/plan`)
    .then((r) => (r.status === 204 || !r.data ? null : r.data)),
};
