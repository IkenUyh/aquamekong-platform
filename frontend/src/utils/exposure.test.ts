import { describe, expect, it } from 'vitest';
import type { FieldDamage, FieldExposure } from '../api/fieldApi';
import { damageSummary, exposureSummary, formatVnd } from './exposure';

const exposure = (over: Partial<FieldExposure>): FieldExposure => ({
  seasonKind: 'CROP_SEASON', seasonStart: '2026-11-01', seasonEnd: '2027-02-04', computedThrough: '2026-11-26',
  seasonDays: 95, daysElapsed: 26, daysWithData: 26, daysExceeded: 0, maxSalinity: 0.8, maxOn: '2026-11-03',
  lastExceededOn: null, threshold: 1.28, thresholdBasis: 'FAO', cumulative: 0, effectiveSalinity: 1.28,
  yieldLossPercent: 0, faoSource: 'FAO 29', damage: null, ...over,
});

describe('exposureSummary', () => {
  it('says how much the rice yield may drop', () => {
    const s = exposureSummary(exposure({
      daysExceeded: 12, maxSalinity: 3.05, maxOn: '2026-11-20', lastExceededOn: '2026-11-24', cumulative: 21.4,
      yieldLossPercent: 25,
    }), 'Lúa');
    expect(s.headline).toBe('Nếu tưới nước này, năng suất lúa có thể giảm khoảng 25%');
    expect(s.severe).toBe(true);
    expect(s.details).toEqual([
      'Vụ từ 01/11/2026, ngày 26/95',
      'Vượt 1,28‰ (mức năng suất bắt đầu giảm) 12 ngày',
      'Mặn cao nhất 3,05‰ ngày 20/11, lần vượt gần nhất 24/11',
      'Mặn tích lũy 21,4‰·ngày, đã nhân hệ số nhạy của giai đoạn',
    ]);
  });

  it('does not round a few salty days to "no loss"', () => {
    const s = exposureSummary(exposure({ daysExceeded: 2, yieldLossPercent: 0 }), 'Lúa');
    expect(s.headline).toBe('Nếu tưới nước này, năng suất lúa giảm dưới 1%');
    expect(s.severe).toBe(false);
  });

  it('counts only days that have readings', () => {
    const s = exposureSummary(exposure({ daysWithData: 20 }), 'Lúa');
    expect(s.headline).toBe('Nếu tưới nước này, năng suất lúa chưa bị giảm');
    expect(s.details[1]).toBe('Vượt 1,28‰ (mức năng suất bắt đầu giảm) 0 ngày trong 20/26 ngày có số đo');
  });

  it('gives no percentage for crops FAO has no curve for', () => {
    const s = exposureSummary(exposure({
      seasonKind: 'DRY_SEASON', seasonStart: '2025-12-01', seasonEnd: '2026-05-31', computedThrough: '2026-05-31',
      thresholdBasis: 'STAGE', threshold: 0.5, daysExceeded: 40, yieldLossPercent: null, cumulative: 30,
    }), 'Sầu riêng');
    expect(s.headline).toBe('Nước ở trạm đã vượt ngưỡng của sầu riêng 40 ngày');
    expect(s.details[0]).toBe('Mùa khô 01/12/2025 – 31/05/2026');
    expect(s.details[1]).toBe('Vượt 0,50‰ (ngưỡng khuyến cáo) 40 ngày');
  });

  it('says when the station has no readings in the season', () => {
    const s = exposureSummary(exposure({ daysWithData: 0, maxSalinity: null, maxOn: null, yieldLossPercent: null }), 'Lúa');
    expect(s.headline).toBe('Trạm chưa có số đo độ mặn trong mùa này');
    expect(s.details).toHaveLength(1);
  });

  it('labels a finished crop season', () => {
    const s = exposureSummary(exposure({ computedThrough: '2027-02-04', daysElapsed: 95 }), 'Lúa');
    expect(s.details[0]).toBe('Vụ 01/11/2026 – 04/02/2027 (đã hết 95 ngày của giống)');
  });
});

const damage = (over: Partial<FieldDamage>): FieldDamage => ({
  areaHa: 1.5, yieldTHa: 7.4, yieldDefault: true, priceVndKg: 7500, priceDefault: true, priceAsOf: '2026-11-26',
  seasonValueVnd: 83_250_000, perPercentVnd: 833_000, lossVnd: 20_813_000, ...over,
});

describe('formatVnd', () => {
  it('reads like people say money', () => {
    expect(formatVnd(20_813_000)).toBe('20,8 triệu đồng');
    expect(formatVnd(1_250_000_000)).toBe('1,3 tỷ đồng');
    expect(formatVnd(833_000)).toBe('833.000 đồng');
  });
});

describe('damageSummary', () => {
  it('shows the estimate, the formula with its defaults, and what 1% is worth', () => {
    expect(damageSummary(damage({}), 25)).toEqual({
      headline: 'Thiệt hại ước tính khoảng 20,8 triệu đồng',
      details: [
        '1,5 ha × 25% × 7,4 tấn/ha × 7.500 đ/kg (năng suất mặc định, giá mặc định ngày 26/11/2026)',
        'Mỗi 1% năng suất của ruộng ≈ 833.000 đồng; cả vụ ≈ 83,3 triệu đồng',
      ],
    });
  });

  it('does not mention defaults the user replaced', () => {
    const s = damageSummary(damage({ yieldDefault: false, priceDefault: false, priceAsOf: null, priceVndKg: 8000 }), 25);
    expect(s.details[0]).toBe('1,5 ha × 25% × 7,4 tấn/ha × 8.000 đ/kg');
  });

  it('asks for the missing numbers instead of guessing', () => {
    const s = damageSummary(damage({ areaHa: null, priceVndKg: null, seasonValueVnd: null, perPercentVnd: null, lossVnd: null }), 25);
    expect(s.headline).toBeNull();
    expect(s.details).toEqual(['Nhập diện tích, giá bán của ruộng ở trang Ruộng để ước thiệt hại ra tiền.']);
  });
});
