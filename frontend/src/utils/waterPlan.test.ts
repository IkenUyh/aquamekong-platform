import { describe, expect, it } from 'vitest';
import type { WaterDay, WaterDayStatus, WaterPlan, WaterStorage } from '../api/fieldApi';
import {
  chipDay, fillByDate, mixText, planSummary, simpleMix, storageLines, storageNote, strongestMixLine, waterDayLabel,
} from './waterPlan';

const day = (date: string, status: WaterDayStatus, freshFraction: number | null = 0): WaterDay => ({
  date, status, salinity: 1, riskSalinity: null, measured: false, threshold: 2, minThreshold: null, freshFraction,
});

const DATES = ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17'];
const plan = (statuses: WaterDayStatus[], fractions: Array<number | null> = []): WaterPlan => ({
  days: statuses.map((s, i) => day(DATES[i], s, fractions[i] ?? 0)),
  storage: null,
  pondSalinityAssumed: 0,
});

const storage = (over: Partial<WaterStorage>): WaterStorage => ({
  dailyNeedM3: 50, kc: 1, et0: 5, kcSource: 'FAO 56', et0Source: 'FAO',
  et0Label: 'tính cho trạm Cần Thơ, trung bình 2008 – 2017', unsafeDays: 5, pondVolumeM3: 160,
  pondDays: 3, pondDaysWithMix: 5, fillBy: '2026-03-11', extraNeededM3: 0, ...over,
});

describe('simpleMix / mixText', () => {
  it('rounds the pond share up to a simple fraction', () => {
    expect(simpleMix(0.2)).toEqual({ pond: 1, river: 3 });
    expect(simpleMix(0.25)).toEqual({ pond: 1, river: 3 });
    expect(simpleMix(0.3)).toEqual({ pond: 1, river: 2 });
    expect(simpleMix(0.34)).toEqual({ pond: 1, river: 1 });
    expect(simpleMix(2 / 3)).toEqual({ pond: 2, river: 1 });
    expect(simpleMix(0.7)).toEqual({ pond: 3, river: 1 });
    expect(simpleMix(0.6)).toEqual({ pond: 2, river: 1 });
    expect(simpleMix(0)).toBeNull();
    expect(simpleMix(0.8)).toBeNull();
  });

  it('says it in words', () => {
    expect(mixText(0.6)).toBe('2 phần nước ao, 1 phần nước sông');
    expect(mixText(0)).toBe('Tưới nước sông được');
    expect(mixText(0.9)).toBe('Chỉ tưới nước ao, không pha nước sông');
    expect(mixText(1)).toBe('Chỉ tưới nước ao, không pha nước sông');
    expect(mixText(null)).toBeNull();
  });
});

describe('labels', () => {
  it('names each day status, with the range wording for aquaculture', () => {
    expect(waterDayLabel('SAFE')).toBe('Lấy được nước sông');
    expect(waterDayLabel('EXCEED', true)).toBe('Ngoài khoảng nuôi');
    expect(waterDayLabel('UNKNOWN')).toBe('Chưa biết');
    expect(chipDay(day('2026-03-10', 'SAFE'), 0)).toBe('Hôm nay');
    expect(chipDay(day('2026-03-11', 'SAFE'), 1)).toBe('11/03');
  });
});

describe('planSummary', () => {
  it('gives the deadline to fill the pond before the first salty day', () => {
    const p = plan(['SAFE', 'SAFE', 'EXCEED', 'RISK', 'EXCEED', 'SAFE', 'SAFE', 'SAFE']);
    expect(fillByDate(p.days)).toBe('2026-03-11');
    expect(planSummary(p)).toBe('Nước sông mặn từ 12/03 (3 trong 8 ngày tới), lấy nước vào ao trước hết ngày 11/03.');
  });

  it('skips unknown days when looking for the deadline', () => {
    const p = plan(['SAFE', 'UNKNOWN', 'EXCEED', 'SAFE', 'SAFE', 'SAFE', 'SAFE', 'SAFE']);
    expect(fillByDate(p.days)).toBe('2026-03-10');
  });

  it('warns when the river is already salty today', () => {
    const p = plan(['EXCEED', 'EXCEED', 'SAFE', 'SAFE', 'SAFE', 'SAFE', 'SAFE', 'SAFE']);
    expect(fillByDate(p.days)).toBeNull();
    expect(planSummary(p)).toBe('Nước sông mặn từ hôm nay (2 trong 8 ngày tới): không lấy nước sông vào ao.');
  });

  it('says when nothing is known or nothing is salty', () => {
    expect(planSummary(plan(Array(8).fill('UNKNOWN')))).toBe(
      'Trạm mất tín hiệu hoặc chưa có dự báo, chưa biết ngày nào lấy được nước sông.');
    expect(planSummary(plan(Array(8).fill('SAFE')))).toBe('8 ngày tới nước sông trong ngưỡng, lấy nước bình thường.');
    expect(planSummary(plan([...Array(7).fill('SAFE'), 'UNKNOWN']))).toBe(
      '8 ngày tới nước sông trong ngưỡng, lấy nước bình thường (1 ngày chưa có dự báo).');
  });

  it('talks about the farming range for aquaculture', () => {
    const p = plan(['SAFE', 'EXCEED', 'SAFE', 'SAFE', 'SAFE', 'SAFE', 'SAFE', 'SAFE'], Array(8).fill(null));
    expect(planSummary(p, true)).toBe(
      'Độ mặn ở trạm ra ngoài khoảng nuôi từ 11/03 (1 trong 8 ngày tới), lấy nước vào ao trước hết ngày 10/03.');
  });
});

describe('strongestMixLine', () => {
  it('names the day that needs the most pond water', () => {
    const p = plan(['SAFE', 'EXCEED', 'EXCEED', 'SAFE', 'SAFE', 'SAFE', 'SAFE', 'SAFE'], [0, 0.4, 0.7]);
    expect(strongestMixLine(p.days)).toBe('Ngày mặn nhất (12/03): 3 phần nước ao, 1 phần nước sông');
    expect(strongestMixLine(plan(Array(8).fill('SAFE')).days)).toBeNull();
  });
});

describe('storageLines', () => {
  it('says the pond lasts some days, or all of them when mixed', () => {
    expect(storageLines(storage({}))).toEqual([
      'Cây cần khoảng 50 m³ nước mỗi ngày',
      'Ao 160 m³ đủ cho 3 trong 5 ngày mặn, nếu pha thì đủ cả 5',
    ]);
    expect(storageLines(storage({ pondDays: 5 }))[1]).toBe('Ao 160 m³ đủ cho cả 5 ngày mặn');
  });

  it('asks for more water when even mixing is not enough', () => {
    expect(storageLines(storage({ pondDaysWithMix: 4, extraNeededM3: 8 }))[1])
      .toBe('Ao 160 m³ đủ cho 3 trong 5 ngày mặn, pha thì đủ 4; cần trữ thêm khoảng 8 m³');
    expect(storageLines(storage({ pondDays: 0, pondDaysWithMix: 0, extraNeededM3: 1200 }))[1])
      .toBe('Ao 160 m³ đủ cho 0 trong 5 ngày mặn; cần trữ thêm khoảng 1.200 m³');
  });

  it('handles fields without a pond or without salty days', () => {
    expect(storageLines(storage({ pondVolumeM3: null, pondDays: 0, pondDaysWithMix: 0, extraNeededM3: 268 }))[1])
      .toBe('Chưa khai ao trữ: cần trữ khoảng 268 m³ nước ngọt cho 5 ngày mặn (đã tính pha)');
    expect(storageLines(storage({ unsafeDays: 0 }))).toEqual(['Cây cần khoảng 50 m³ nước mỗi ngày']);
  });

  it('says rice needs more than this', () => {
    expect(storageNote(storage({ kc: 1.2 }), true)).toContain('Với lúa đây là mức tối thiểu');
    expect(storageNote(storage({ kc: 1.2 }), false)).toBe(
      'Theo FAO 56: Kc 1,2 × ET₀ 5 mm/ngày (ET₀ tính cho trạm Cần Thơ, trung bình 2008 – 2017).');
    expect(storageNote(storage({ et0Label: null }), false)).toBe('Theo FAO 56: Kc 1 × ET₀ 5 mm/ngày.');
  });
});
