import { describe, expect, it } from 'vitest';
import type { SalinityForecast } from '../types';
import { storedForecasts, usableForecasts } from './forecastSelection';

const NOW = new Date('2026-10-06T09:00:00');
const f = (forecastDate: string, extra: Partial<SalinityForecast> = {}): SalinityForecast =>
  ({ id: 1, stationId: 1, forecastDate, predictedSalinity: 1, runAt: '2026-10-06T08:00:00+07:00', ...extra });

describe('usableForecasts', () => {
  it('accepts an ST-GNN run from today even though its days start from the last data day', () => {
    const run = [f('2026-09-01', { dataUntil: '2026-08-31' }), f('2026-09-07', { dataUntil: '2026-08-31' })];
    expect(usableForecasts(run, 7, NOW)?.map((x) => x.forecastDate)).toEqual(['2026-09-01', '2026-09-07']);
  });

  it('re-runs when an ST-GNN run does not reach the requested horizon or is from another day', () => {
    const run = [f('2026-09-01', { dataUntil: '2026-08-31' }), f('2026-09-07', { dataUntil: '2026-08-31' })];
    expect(usableForecasts(run, 14, NOW)).toBeNull();
    const yesterday = run.map((x) => ({ ...x, runAt: '2026-10-05T08:00:00+07:00' }));
    expect(usableForecasts(yesterday, 7, NOW)).toBeNull();
  });


// TODO: complete edge-case assertions and verification
