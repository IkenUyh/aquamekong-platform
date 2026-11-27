import { describe, expect, it } from 'vitest';
import type { FieldPlan, PlanAction, WaterDayStatus } from '../api/fieldApi';
import type { RecommendationDto } from '../api/recommendationApi';
import { dayLabel, groupByDay, isPersonal, splitFieldPrefix, VERDICT } from './actionPlan';
import { WATER_DAY_CHIP } from './waterPlan';

const DATES = ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'];
const STATUSES: WaterDayStatus[] = ['SAFE', 'SAFE', 'EXCEED', 'EXCEED', 'EXCEED', 'RISK', 'SAFE', 'UNKNOWN'];

const action = (kind: string, from: string, until = from, priority: PlanAction['priority'] = 'MEDIUM'): PlanAction => ({
  kind, priority, from, until, fraction: null, message: `${kind} ${from}`, source: 'WATER',
});

const plan = (actions: PlanAction[]): FieldPlan => ({
  verdict: 'YELLOW',
  headline: 'Có, tới hết ngày 15/11; từ 16/11 nước sông mặn.',
  actions,
  waterPlan: {
    days: DATES.map((date, i) => ({
      date, status: STATUSES[i], salinity: 1, riskSalinity: null, measured: false, threshold: 4, minThreshold: null,
      freshFraction: 0,
    })),
    storage: null,
    pondSalinityAssumed: 0,
  },
});

describe('VERDICT', () => {
  it('maps every verdict to a status level, red only when today is salty', () => {
    expect(VERDICT.RED.level).toBe('CRITICAL');
    expect(VERDICT.YELLOW.level).toBe('WARNING');
    expect(VERDICT.GREEN.level).toBe('SAFE');
    expect(VERDICT.GREY.level).toBe('INFO');
  });
});

describe('dayLabel', () => {
  it('names today and tomorrow, then dd/MM', () => {
    expect(dayLabel('2026-11-14', '2026-11-14')).toBe('Hôm nay');
    expect(dayLabel('2026-11-15', '2026-11-14')).toBe('Ngày mai');
    expect(dayLabel('2026-11-16', '2026-11-14')).toBe('16/11');
    // Qua tháng
    expect(dayLabel('2026-12-01', '2026-11-30')).toBe('Ngày mai');
  });
});

describe('groupByDay', () => {
  it('groups actions by start day and keeps the take-water line apart', () => {
    const { groups, takeWater } = groupByDay(plan([
      action('STORE', '2026-11-15', '2026-11-15', 'HIGH'),
      action('MIX', '2026-11-16', '2026-11-18'),
      action('FERTILIZE', '2026-11-16'),
      action('CHECK', '2026-11-19'),
      action('TAKE_WATER', '2026-11-14', '2026-11-20', 'LOW'),
    ]));

    expect(groups.map((g) => g.label)).toEqual(['Ngày mai', '16/11', '19/11']);
    expect(groups[1].actions.map((a) => a.kind)).toEqual(['MIX', 'FERTILIZE']);
    expect(groups[0].chip).toBe(WATER_DAY_CHIP.SAFE);
    expect(groups[1].chip).toBe(WATER_DAY_CHIP.EXCEED);
    expect(groups[2].chip).toBe(WATER_DAY_CHIP.RISK);
    expect(takeWater?.kind).toBe('TAKE_WATER');
  });

  it('a date outside the water plan gets the grey chip', () => {
    const { groups, takeWater } = groupByDay(plan([action('FERTILIZE', '2026-11-25')]));
    expect(groups[0].chip).toBe(WATER_DAY_CHIP.UNKNOWN);
    expect(takeWater).toBeNull();
  });
});

describe('splitFieldPrefix', () => {
  const rec = (message: string, fieldName?: string): RecommendationDto => ({
    type: 'WATER_STORAGE', priority: 'HIGH', message, fieldName, fieldId: fieldName ? 1 : undefined,
  });

  it('splits the field name and crop off a personal recommendation', () => {
    expect(splitFieldPrefix(rec('Ruộng A (lúa): Trữ đầy ao trước hết ngày 15/11', 'Ruộng A')))
      .toEqual({ field: 'Ruộng A (lúa)', text: 'Trữ đầy ao trước hết ngày 15/11' });
  });

  it('leaves general recommendations alone', () => {
    expect(splitFieldPrefix(rec('Hạn chế lấy nước tưới tại khu vực Mỹ Tho (5,0‰)'))).toBeNull();
    expect(splitFieldPrefix(rec('Khác: việc gì đó', 'Ruộng A'))).toBeNull();
  });

  it('tells whether the list is personal', () => {
    expect(isPersonal([rec('x'), rec('Ruộng A (lúa): y', 'Ruộng A')])).toBe(true);
    expect(isPersonal([rec('x')])).toBe(false);
  });
});
