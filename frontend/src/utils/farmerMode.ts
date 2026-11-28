import type { PlanVerdict, WaterDayStatus } from '../api/fieldApi';

/**
 * Chế độ Nông dân: bật/tắt và lựa chọn đã lưu (trạm + cây, hoặc một ruộng đã khai), giữ trong localStorage trên máy.
 * Trình duyệt chặn lưu trữ (chế độ riêng tư, WebView) thì giữ trong bộ nhớ: vẫn dùng được, chỉ mất khi tải lại trang.
 */

export const MODE_KEY = 'aquamekong.farmerMode';
export const CHOICE_KEY = 'aquamekong.farmerChoice';

export interface FarmerChoice {
  stationId: number;
  cropCode: string;
  /** YYYY-MM-DD, chỉ cây chia giai đoạn (lúa) */
  plantedOn?: string;
  varietyDays?: number;
  /** Dùng ruộng đã khai: kế hoạch đầy đủ của ruộng (ao, tỷ lệ pha) */
  fieldId?: number;
}

export interface FarmerState {
  on: boolean;
  choice: FarmerChoice | null;
}

const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const value = globalThis.localStorage?.getItem(key);
    if (value != null) return value;
  } catch {
    // Bị chặn: dùng bản trong bộ nhớ
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string | null) {
  if (value == null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value == null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // Bị chặn: chỉ còn bản trong bộ nhớ
  }
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isId = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/** Lựa chọn đã lưu, null khi chưa có hoặc dữ liệu hỏng */
export function parseChoice(raw: string | null): FarmerChoice | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!isId(p?.stationId) || typeof p?.cropCode !== 'string' || !p.cropCode) return null;
    const choice: FarmerChoice = { stationId: p.stationId, cropCode: p.cropCode };
    if (isDate(p.plantedOn)) choice.plantedOn = p.plantedOn;
    if (isId(p.varietyDays)) choice.varietyDays = p.varietyDays;
    if (isId(p.fieldId)) choice.fieldId = p.fieldId;
    return choice;
  } catch {
    return null;
  }
}

export function readFarmerState(): FarmerState {
  return { on: read(MODE_KEY) === '1', choice: parseChoice(read(CHOICE_KEY)) };
}

export function writeFarmerMode(on: boolean) {
  write(MODE_KEY, on ? '1' : null);
}

export function writeFarmerChoice(choice: FarmerChoice | null) {
  write(CHOICE_KEY, choice ? JSON.stringify(choice) : null);
}

/** Chỉ dùng trong test: xoá bản trong bộ nhớ */
export function resetFarmerMemory() {
  memory.clear();
}

/**
 * Lời cho thẻ trả lời lớn. Không chỉ dựa vào màu: luôn có chữ và biểu tượng (tên biểu tượng ở đây, trang chọn
 * component lucide tương ứng).
 */
export const FARMER_VERDICT: Record<PlanVerdict, { label: string; icon: 'ok' | 'warn' | 'stop' | 'unknown'; card: string }> = {
  GREEN: { label: 'Lấy nước được', icon: 'ok', card: 'bg-green-50 border-green-300 text-green-900' },
  YELLOW: { label: 'Cẩn thận', icon: 'warn', card: 'bg-yellow-50 border-yellow-400 text-yellow-900' },
  RED: { label: 'Không lấy nước sông', icon: 'stop', card: 'bg-red-50 border-red-400 text-red-900' },
  GREY: { label: 'Chưa có số mới', icon: 'unknown', card: 'bg-gray-50 border-gray-300 text-gray-800' },
};

export const farmerVerdict = (verdict: PlanVerdict | string | null | undefined) =>
  FARMER_VERDICT[verdict as PlanVerdict] ?? FARMER_VERDICT.GREY;

/** Nhãn ngắn trong ô ngày (ô hẹp, chữ lớn) */
export function farmerDayLabel(status: WaterDayStatus, aquaculture = false): string {
  switch (status) {
    case 'SAFE': return aquaculture ? 'Trong khoảng' : 'Lấy được';
    case 'RISK': return 'Có thể mặn';
    case 'EXCEED': return aquaculture ? 'Ngoài khoảng' : 'Mặn';
    default: return 'Chưa biết';
  }
}

/** Màu ô ngày: như WATER_DAY_CHIP nhưng chữ đậm hơn (chữ lớn, người lớn tuổi, nắng gắt) */
export const FARMER_DAY_CHIP: Record<WaterDayStatus, string> = {
  SAFE: 'bg-green-50 border-green-400 text-green-900',
  RISK: 'bg-yellow-50 border-yellow-500 text-yellow-900',
  EXCEED: 'bg-red-100 border-red-400 text-red-900',
  UNKNOWN: 'bg-gray-100 border-gray-300 text-gray-800',
};

/** Nút lớn của chế độ Nông dân: cao tối thiểu 48px, chữ 18px */
export const BIG_BUTTON = 'min-h-12 rounded-xl px-4 py-3 text-lg font-semibold';

/** Số ngày giống lúa hay gặp ở ĐBSCL, để chọn nhanh */
export const VARIETY_DAY_CHIPS = [90, 95, 100, 105];

/** Lỗi của bước ngày gieo + số ngày giống (cùng quy tắc với backend FieldProfileService.validateSchedule), null khi đúng */
export function farmerScheduleError(plantedOn: string, varietyDays: number | null, fixedDays: number): string | null {
  if (!isDate(plantedOn)) return 'Chọn ngày gieo sạ.';
  if (varietyDays == null || !Number.isInteger(varietyDays)) return 'Chọn số ngày của giống.';
  if (varietyDays <= fixedDays) return `Số ngày của giống phải lớn hơn ${fixedDays} ngày.`;
  if (varietyDays > 3650) return 'Số ngày của giống quá lớn.';
  return null;
}
