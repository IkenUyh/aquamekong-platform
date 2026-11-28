import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHOICE_KEY, farmerDayLabel, farmerScheduleError, farmerVerdict, FARMER_VERDICT, MODE_KEY, parseChoice,
  readFarmerState, resetFarmerMemory, writeFarmerChoice, writeFarmerMode,
} from './farmerMode';

/** localStorage giả trong môi trường node của vitest */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

/** Trình duyệt chặn lưu trữ: mọi lệnh đều ném lỗi */
const throwingStorage = {
  getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
  setItem: () => { throw new DOMException('blocked', 'SecurityError'); },
  removeItem: () => { throw new DOMException('blocked', 'SecurityError'); },
};

describe('farmer mode storage', () => {
  beforeEach(() => resetFarmerMemory());
  afterEach(() => vi.unstubAllGlobals());

  it('is off with no choice by default', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(readFarmerState()).toEqual({ on: false, choice: null });
  });

  it('keeps the flag and the choice in localStorage', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    writeFarmerMode(true);
    writeFarmerChoice({ stationId: 3, cropCode: 'lua', plantedOn: '2026-11-01', varietyDays: 95 });
    expect(storage.data.get(MODE_KEY)).toBe('1');
    resetFarmerMemory();
    expect(readFarmerState()).toEqual({
      on: true, choice: { stationId: 3, cropCode: 'lua', plantedOn: '2026-11-01', varietyDays: 95 },
    });

    writeFarmerMode(false);
    writeFarmerChoice(null);
    expect(storage.data.has(MODE_KEY)).toBe(false);
    expect(storage.data.has(CHOICE_KEY)).toBe(false);
    expect(readFarmerState()).toEqual({ on: false, choice: null });
  });

  it('still works in memory when storage throws', () => {
    vi.stubGlobal('localStorage', throwingStorage);
    expect(readFarmerState()).toEqual({ on: false, choice: null });
    writeFarmerMode(true);
    writeFarmerChoice({ stationId: 5, cropCode: 'dua' });
    expect(readFarmerState()).toEqual({ on: true, choice: { stationId: 5, cropCode: 'dua' } });
  });

  it('works without any localStorage', () => {
    vi.stubGlobal('localStorage', undefined);
    writeFarmerMode(true);
    expect(readFarmerState().on).toBe(true);
  });

  it('drops broken or partial saved choices', () => {
    expect(parseChoice('not json')).toBeNull();
    expect(parseChoice('{"cropCode":"lua"}')).toBeNull();
    expect(parseChoice('{"stationId":"3","cropCode":"lua"}')).toBeNull();
    expect(parseChoice('{"stationId":3,"cropCode":""}')).toBeNull();
    expect(parseChoice('{"stationId":3,"cropCode":"lua","plantedOn":"01/11/2026","varietyDays":-1,"fieldId":7}'))
      .toEqual({ stationId: 3, cropCode: 'lua', fieldId: 7 });
  });
});

describe('verdict labels', () => {
  it('says what to do in words, not only colour', () => {
    expect(farmerVerdict('GREEN').label).toBe('Lấy nước được');
    expect(farmerVerdict('YELLOW').label).toBe('Cẩn thận');
    expect(farmerVerdict('RED').label).toBe('Không lấy nước sông');
    expect(farmerVerdict('GREY').label).toBe('Chưa có số mới');
    expect(new Set(Object.values(FARMER_VERDICT).map((v) => v.icon)).size).toBe(4);
  });

  it('treats an unknown verdict as "no fresh data"', () => {
    expect(farmerVerdict('PURPLE')).toBe(FARMER_VERDICT.GREY);
    expect(farmerVerdict(undefined)).toBe(FARMER_VERDICT.GREY);
  });

  it('labels each day, with ranges for aquaculture', () => {
    expect(farmerDayLabel('SAFE')).toBe('Lấy được');
    expect(farmerDayLabel('EXCEED')).toBe('Mặn');
    expect(farmerDayLabel('EXCEED', true)).toBe('Ngoài khoảng');
    expect(farmerDayLabel('RISK')).toBe('Có thể mặn');
    expect(farmerDayLabel('UNKNOWN')).toBe('Chưa biết');
  });
});

describe('farmerScheduleError', () => {
  it('needs a sowing date and a variety longer than the fixed stages', () => {
    expect(farmerScheduleError('', 95, 65)).toMatch(/ngày gieo/);
    expect(farmerScheduleError('2026-11-01', null, 65)).toMatch(/số ngày/);
    expect(farmerScheduleError('2026-11-01', 60, 65)).toMatch(/lớn hơn 65/);
    expect(farmerScheduleError('2026-11-01', 95, 65)).toBeNull();
  });
});
