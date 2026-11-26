import { describe, expect, it } from 'vitest';
import { NO_ECONOMICS, type Crop } from '../api/cropApi';
import { decimal, EMPTY_FIELD_FORM, fieldRequest, thresholdText } from './fieldForm';

const stage = (code: string, order: number, durationDays: number | null, flexible = false) => ({
  code, name: code, order, durationDays, flexible, durationSource: null,
  maxSalinity: 4, minSalinity: null, thresholdSource: 'x', thresholdNote: null, saltSensitivity: 1, sensitivitySource: null,
});

const rice: Crop = {
  code: 'lua', name: 'Lúa', category: 'CROP', faoYield: null, faoNote: null, economics: NO_ECONOMICS,
  stages: [stage('ma', 1, null), stage('de_nhanh', 2, null, true), stage('lam_dong_tro', 3, 35), stage('chin', 4, 30)],
};
const durian: Crop = { ...rice, code: 'sau_rieng', name: 'Sầu riêng', stages: [stage('ca_nam', 1, null, true)] };

const form = { ...EMPTY_FIELD_FORM, name: ' Ruộng sau nhà ', stationId: 3 as const, cropCode: 'lua' };

describe('fieldRequest', () => {
  it('builds the request with Vietnamese decimals', () => {
    const r = fieldRequest({ ...form, varietyDays: '95', plantedOn: '2026-11-01', areaHa: '1,5', hasPond: true, pondVolumeM3: '1.200' }, rice);
    expect(r).toEqual({
      req: {
        name: 'Ruộng sau nhà', stationId: 3, cropCode: 'lua', variety: null, varietyDays: 95, plantedOn: '2026-11-01',
        areaHa: 1.5, hasPond: true, pondVolumeM3: 1200, yieldTHa: null, priceVndKg: null,
      },
    });
  });

  it('reads yield and price the Vietnamese way, blank means the crop default', () => {
    const base = { ...form, varietyDays: '95', plantedOn: '2026-11-01' };
    const r = fieldRequest({ ...base, yieldTHa: '6,5', priceVndKg: '7.800' }, rice);
    expect('req' in r && [r.req.yieldTHa, r.req.priceVndKg]).toEqual([6.5, 7800]);
    const blank = fieldRequest(base, rice);
    expect('req' in blank && [blank.req.yieldTHa, blank.req.priceVndKg]).toEqual([null, null]);
    expect(fieldRequest({ ...base, priceVndKg: '0' }, rice)).toEqual({ error: 'Giá bán phải lớn hơn 0 đồng/kg.' });
  });

  it('rice needs a sowing date and a variety longer than the fixed stages', () => {
    expect(fieldRequest({ ...form, varietyDays: '95' }, rice)).toEqual({ error: 'Nhập ngày gieo sạ để app tính giai đoạn lúa.' });
    expect(fieldRequest({ ...form, varietyDays: '60', plantedOn: '2026-11-01' }, rice))
      .toEqual({ error: 'Số ngày của giống phải lớn hơn 65 ngày.' });
  });

  it('a single-stage crop needs no dates, and the pond volume is dropped without a pond', () => {
    const r = fieldRequest({ ...form, cropCode: 'sau_rieng', pondVolumeM3: '500' }, durian);
    expect('req' in r && r.req.pondVolumeM3).toBeNull();
  });

  it('asks for the station and the name first', () => {
    expect(fieldRequest({ ...form, stationId: '' }, rice)).toEqual({ error: 'Chọn trạm gần ruộng.' });
    expect(fieldRequest({ ...form, name: ' ' }, rice)).toHaveProperty('error');
  });
});

describe('decimal', () => {
  it('reads Vietnamese and machine-style numbers', () => {
    expect(decimal('1,5')).toBe(1.5);
    expect(decimal('1.5')).toBe(1.5);
    expect(decimal('1.200')).toBe(1200);
    expect(decimal('1.200,5')).toBe(1200.5);
    expect(decimal(' ')).toBeNull();
    expect(decimal('abc')).toBeNaN();
  });
});

describe('thresholdText', () => {
  it('shows a range for shrimp', () => {
    expect(thresholdText(35, 5)).toBe('khoảng 5–35‰');
    expect(thresholdText(0.5, null)).toBe('ngưỡng 0,5‰');
    expect(thresholdText(null, null)).toBeNull();
  });
});
