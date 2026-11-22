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
}

export const EMPTY_FIELD_FORM: FieldForm = {
  name: '', stationId: '', cropCode: '', variety: '', varietyDays: '', plantedOn: '', areaHa: '', hasPond: false, pondVolumeM3: '',
};

export function formFromField(f: FieldProfile): FieldForm {
  return {
    name: f.name, stationId: f.stationId ?? '', cropCode: f.cropCode, variety: f.variety ?? '',
    varietyDays: f.varietyDays == null ? '' : String(f.varietyDays), plantedOn: f.plantedOn ?? '',
    areaHa: f.areaHa == null ? '' : String(f.areaHa).replace('.', ','), hasPond: f.hasPond,
    pondVolumeM3: f.pondVolumeM3 == null ? '' : String(f.pondVolumeM3).replace('.', ','),
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

/** Kiểm tra form và đổi sang request; lỗi trả về câu báo cho người dùng */
export function fieldRequest(form: FieldForm, crop: Crop | undefined): { req: FieldRequest } | { error: string } {
  if (!form.name.trim()) return { error: 'Đặt tên cho ruộng (vd. Ruộng sau nhà).' };
  if (form.stationId === '') return { error: 'Chọn trạm gần ruộng.' };
  if (!crop) return { error: 'Chọn cây trồng.' };
  const schedule = needsSchedule(crop);
  const days = form.varietyDays.trim() === '' ? null : Number(form.varietyDays);
  if (days != null && !(Number.isInteger(days) && days >= 1 && days <= 3650)) {
    return { error: 'Số ngày của giống phải là số nguyên từ 1 đến 3650.' };
  }
  if (schedule) {
    if (!form.plantedOn) return { error: `Nhập ngày gieo sạ để app tính giai đoạn ${crop.name.toLowerCase()}.` };
    if (days == null) return { error: 'Nhập số ngày của giống (vd. 95).' };
    if (days <= fixedDays(crop)) return { error: `Số ngày của giống phải lớn hơn ${fixedDays(crop)} ngày.` };
  }
  const area = decimal(form.areaHa);
  if (area != null && !(area > 0 && area <= 100000)) return { error: 'Diện tích phải lớn hơn 0.' };
  const pond = form.hasPond ? decimal(form.pondVolumeM3) : null;
  if (pond != null && !(pond > 0)) return { error: 'Dung tích ao phải lớn hơn 0.' };
  return {
    req: {
      name: form.name.trim(), stationId: form.stationId, cropCode: crop.code,
      variety: form.variety.trim() || null, varietyDays: days, plantedOn: form.plantedOn || null,
      areaHa: area, hasPond: form.hasPond, pondVolumeM3: pond,
    },
  };
}

/** "Ngưỡng 4‰" hoặc "Khoảng 5–35‰" */
export function thresholdText(threshold: number | null, minThreshold: number | null): string | null {
  if (threshold == null) return null;
  return minThreshold == null ? `ngưỡng ${formatNumber(threshold)}‰` : `khoảng ${formatNumber(minThreshold)}–${formatNumber(threshold)}‰`;
}

/** "Làm đòng – trổ, ngày 41" / "Chưa gieo" / "Đã quá số ngày của giống" */
export function stageText(f: FieldProfile): string | null {
  const s = f.stage;
  if (!s) return null;
  if (s.beforePlanting) return 'Chưa tới ngày gieo';
  if (s.pastHarvest) return `Đã quá ${f.varietyDays} ngày của giống`;
  return s.day == null ? s.name : `${s.name}, ngày ${s.day}`;
}
