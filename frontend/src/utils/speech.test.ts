import { describe, expect, it } from 'vitest';
import type { FieldPlan, PlanAction, WaterDay } from '../api/fieldApi';
import { pickVietnameseVoice, planSpeech, spokenDate, toSpeech } from './speech';

const action = (kind: string, from: string, message: string): PlanAction => ({
  kind, priority: 'HIGH', from, until: from, fraction: null, message, source: 'WATER',
});

const day = (date: string): WaterDay => ({
  date, status: 'SAFE', salinity: 1, riskSalinity: null, measured: false, threshold: 4, minThreshold: null, freshFraction: 0,
});

describe('toSpeech', () => {
  it('reads dates as day and month', () => {
    expect(spokenDate('2026-11-16')).toBe('ngày 16 tháng 11');
    expect(toSpeech('Có, tới hết ngày 15/11; từ 16/11 nước sông mặn.'))
      .toBe('Có, tới hết ngày 15 tháng 11; từ ngày 16 tháng 11 nước sông mặn.');
    expect(toSpeech('Ngày 03/12 không lấy nước')).toBe('ngày 3 tháng 12 không lấy nước');
  });

  it('reads ‰, m³, mix fractions and ranges', () => {
    expect(toSpeech('mặn tới 8,5‰, ngưỡng 4‰')).toBe('mặn tới 8,5 phần nghìn, ngưỡng 4 phần nghìn');
    expect(toSpeech('cần thêm khoảng 1.200 m³')).toBe('cần thêm khoảng 1.200 mét khối');
    expect(toSpeech('tưới pha 2/3 nước ao, 1/3 nước sông')).toBe('tưới pha 2 phần 3 nước ao, 1 phần 3 nước sông');
    expect(toSpeech('khoảng 5–35‰')).toBe('khoảng 5 đến 35 phần nghìn');
  });
});

describe('planSpeech', () => {
  const plan: FieldPlan = {
    verdict: 'YELLOW',
    headline: 'Có, tới hết ngày 15/11; từ 16/11 nước sông mặn.',
    actions: [
      action('STORE', '2026-11-14', 'Trữ nước ngọt (bồn, kênh nội đồng) trước hết ngày 15/11'),
      action('FERTILIZE', '2026-11-15', 'Bón thúc trước khi mặn'),
      action('STOP_INTAKE', '2026-11-16', 'Từ 16/11 tới 21/11 không lấy nước sông tưới: mặn tới 8‰, ngưỡng 4‰'),
      action('TAKE_WATER', '2026-11-14', 'Lấy nước được: 14/11 – 15/11'),
    ],
    waterPlan: { days: ['2026-11-14', '2026-11-15'].map(day), storage: null, pondSalinityAssumed: 0 },
  };

  it('reads the headline and the first three actions, no slash dates or ‰ left', () => {
    const text = planSpeech(plan);
    expect(text).toBe('Tuần này lấy nước được không? Có, tới hết ngày 15 tháng 11; từ ngày 16 tháng 11 nước sông mặn. '
      + 'Việc cần làm. Trữ nước ngọt (bồn, kênh nội đồng) trước hết ngày 15 tháng 11. '
      + 'Ngày mai: Bón thúc trước khi mặn. '
      + 'Từ ngày 16 tháng 11 tới ngày 21 tháng 11 không lấy nước sông tưới: mặn tới 8 phần nghìn, ngưỡng 4 phần nghìn.');
    expect(text).not.toMatch(/\d\/\d|‰/);
    expect(text).not.toContain('Lấy nước được:');
  });

  it('says the date of an action that names none', () => {
    const later: FieldPlan = { ...plan, actions: [action('FERTILIZE', '2026-11-18', 'Bón thúc')] };
    expect(planSpeech(later)).toContain('ngày 18 tháng 11: Bón thúc.');
  });
});

describe('pickVietnameseVoice', () => {
  it('prefers vi-VN, accepts Android style vi_VN, else nothing', () => {
    expect(pickVietnameseVoice([{ lang: 'en-US' }, { lang: 'vi' }, { lang: 'vi-VN' }])).toEqual({ lang: 'vi-VN' });
    expect(pickVietnameseVoice([{ lang: 'en-US' }, { lang: 'vi_VN' }])).toEqual({ lang: 'vi_VN' });
    expect(pickVietnameseVoice([{ lang: 'en-US' }])).toBeNull();
    expect(pickVietnameseVoice([])).toBeNull();
  });
});
