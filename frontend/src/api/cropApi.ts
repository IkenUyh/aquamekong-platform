import apiClient from './client';

/** Mức mặn nước tưới ứng với năng suất còn 100/90/75/50% (FAO 29): ECw (dS/m) như FAO in, và quy ra ‰ */
export interface FaoYield {
  ecw100: number; ecw90: number; ecw75: number; ecw50: number;
  ppt100: number; ppt90: number; ppt75: number; ppt50: number;
  source: string;
}

export interface CropStage {
  code: string;
  name: string;
  order: number;
  /** Số ngày cố định, null khi co giãn theo giống hoặc chưa có nguồn */
  durationDays: number | null;
  /** Nhận phần ngày còn lại của giống */
  flexible: boolean;
  durationSource: string | null;
  /** Báo khi vượt mức này (‰), null = chưa có nguồn */
  maxSalinity: number | null;
  /** Báo khi xuống dưới mức này (‰), chỉ với mức cần khoảng mặn (nuôi tôm) */
  minSalinity: number | null;
  thresholdSource: string | null;
  thresholdNote: string | null;
  /** Hệ số nhân phần mặn vượt ngưỡng khi tính mức mặn tích lũy, 1 = như FAO 29 */
  saltSensitivity: number;
  sensitivitySource: string | null;
}

/** Năng suất và giá mặc định để ước thiệt hại ra tiền; null = chưa có nguồn, người dùng tự nhập */
export interface CropEconomics {
  /** Tấn/ha mỗi vụ (cây lâu năm: mỗi năm) */
  yieldTHa: number | null;
  yieldSource: string | null;
  /** Đồng/kg tại ruộng/vườn */
  priceVndKg: number | null;
  priceSource: string | null;
  /** YYYY-MM-DD, ngày lấy giá */
  priceAsOf: string | null;
}

export const NO_ECONOMICS: CropEconomics = {
  yieldTHa: null, yieldSource: null, priceVndKg: null, priceSource: null, priceAsOf: null,
};

export interface Crop {
  code: string;
  name: string;
  category: 'CROP' | 'DOMESTIC_WATER' | 'AQUACULTURE';
  faoYield: FaoYield | null;
  faoNote: string | null;
  stages: CropStage[];
  economics: CropEconomics;
}

/** Cây chia nhiều giai đoạn (lúa) cần ngày gieo và số ngày của giống */
export const needsSchedule = (crop: Crop) => crop.stages.length > 1;

/** Tổng số ngày các giai đoạn cố định: số ngày của giống phải lớn hơn */
export const fixedDays = (crop: Crop) => crop.stages.reduce((sum, s) => sum + (s.durationDays ?? 0), 0);

export const cropApi = {
  list: () => apiClient.get<Crop[]>('/crops').then((r) => r.data),
};
