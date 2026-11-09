import { describe, expect, it } from 'vitest';
import type { AlertDto } from '../types';
import { activeSince } from './alertPeriod';

const DAY = 86_400_000;
const now = Date.parse('2026-10-17T12:00:00Z');
const since = now - 7 * DAY;
const alert = (over: Partial<AlertDto>): AlertDto => ({ id: 1, stationId: 1, createdAt: '2026-10-08T17:00:00Z', ...over } as AlertDto);

describe('activeSince', () => {
  it('keeps an alert that started before the period and is still open', () => {
    expect(activeSince(alert({ status: 'ACTIVE' }), since)).toBe(true);
    expect(activeSince(alert({ status: 'ACKNOWLEDGED' }), since)).toBe(true);
  });

  it('keeps a resolved alert only if it was still open during the period', () => {
    expect(activeSince(alert({ status: 'RESOLVED', resolvedAt: '2026-10-12T00:00:00Z' }), since)).toBe(true);
    expect(activeSince(alert({ status: 'RESOLVED', resolvedAt: '2026-10-09T00:00:00Z' }), since)).toBe(false);
  });
});
