import { fixedDays, needsSchedule, type Crop } from '../api/cropApi';
import type { FieldProfile, FieldRequest } from '../api/fieldApi';
import { formatNumber } from './salinity';

/** Giá trị các ô của form hồ sơ ruộng (chuỗi như người dùng gõ) */
export interface FieldForm {
  name: string;
  stationId: number | '';
  cropCode: string;
  variety: string;
  varietyDays: string;
  plantedOn: string;
  areaHa: string;
  hasPond: boolean;
  pondVolumeM3: string;
  /** Trống = dùng năng suất mặc định của cây */
  yieldTHa: string;
  /** Trống = dùng giá mặc định của cây */
  priceVndKg: string;
}

export const EMPTY_FIELD_FORM: FieldForm = {
  name: '', stationId: '', cropCode: '', variety: '', varietyDays: '', plantedOn: '', areaHa: '', hasPond: false, pondVolumeM3: '',
  yieldTHa: '', priceVndKg: '',
};

/** Số thập phân để hiện lại trong ô nhập, dấu phẩy kiểu Việt Nam */
const asInput = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));

export function formFromField(f: FieldProfile): FieldForm {
  return {
    name: f.name, stationId: f.stationId ?? '', cropCode: f.cropCode, variety: f.variety ?? '',
    varietyDays: f.varietyDays == null ? '' : String(f.varietyDays), plantedOn: f.plantedOn ?? '',
    areaHa: asInput(f.areaHa), hasPond: f.hasPond, pondVolumeM3: asInput(f.pondVolumeM3),
    yieldTHa: asInput(f.yieldTHa), priceVndKg: asInput(f.priceVndKg),
  };
}

/**
 * Số thập phân gõ kiểu Việt Nam ("1,5", "1.200") hoặc kiểu máy ("1.5"); chuỗi trống là null, sai là NaN.
 * Dấu chấm là phân cách hàng nghìn khi có dấu phẩy hoặc khi đúng dạng nhóm 3 chữ số ("1.200").
 */
export function decimal(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  if (t.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t);
}

/** Lỗi ở phần cây trồng (bước 1 của form): cây, số ngày của giống, ngày gieo; null = hợp lệ */
export function cropStepError(form: FieldForm, crop: Crop | undefined): string | null {
  if (!crop) return 'Chọn cây trồng.';
  const days = form.varietyDays.trim() === '' ? null : Number(form.varietyDays);
  if (days != null && !(Number.isInteger(days) && days >= 1 && days <= 3650)) {
    return 'Số ngày của giống phải là số nguyên từ 1 đến 3650.';
  }
  if (needsSchedule(crop)) {
    if (!form.plantedOn) return `Nhập ngày gieo sạ để app tính giai đoạn ${crop.name.toLowerCase()}.`;
    if (days == null) return 'Nhập số ngày của giống (vd. 95).';
    if (days <= fixedDays(crop)) return `Số ngày của giống phải lớn hơn ${fixedDays(crop)} ngày.`;
  }
  return null;
}

/** Kiểm tra form và đổi sang request; lỗi trả về câu báo cho người dùng */
export function fieldRequest(form: FieldForm, crop: Crop | undefined): { req: FieldRequest } | { error: string } {
  if (!form.name.trim()) return { error: 'Đặt tên cho ruộng (vd. Ruộng sau nhà).' };
  if (form.stationId === '') return { error: 'Chọn trạm gần ruộng.' };
  const cropError = cropStepError(form, crop);
  if (cropError || !crop) return { error: cropError ?? 'Chọn cây trồng.' };
  const days = form.varietyDays.trim() === '' ? null : Number(form.varietyDays);
  const area = decimal(form.areaHa);
  if (area != null && !(area > 0 && area <= 100000)) return { error: 'Diện tích phải lớn hơn 0.' };
  const pond = form.hasPond ? decimal(form.pondVolumeM3) : null;
  if (pond != null && !(pond > 0)) return { error: 'Dung tích ao phải lớn hơn 0.' };
  const yieldTHa = decimal(form.yieldTHa);
  if (yieldTHa != null && !(yieldTHa > 0 && yieldTHa <= 500)) return { error: 'Năng suất phải từ trên 0 tới 500 tấn/ha.' };
  const price = decimal(form.priceVndKg);
  if (price != null && !(price > 0 && price <= 10_000_000)) return { error: 'Giá bán phải lớn hơn 0 đồng/kg.' };
  return {
    req: {
      name: form.name.trim(), stationId: form.stationId, cropCode: crop.code,
      variety: form.variety.trim() || null, varietyDays: days, plantedOn: form.plantedOn || null,
      areaHa: area, hasPond: form.hasPond, pondVolumeM3: pond, yieldTHa, priceVndKg: price,
    },
  };
}

/** "Ngưỡng 4‰" hoặc "Khoảng 5–35‰" */
export function thresholdText(threshold: number | null, minThreshold: number | null): string | null {
  if (threshold == null) return null;
  return minThreshold == null ? `ngưỡng ${formatNumber(threshold)}‰` : `khoảng ${formatNumber(minThreshold)}–${formatNumber(threshold)}‰`;
}

