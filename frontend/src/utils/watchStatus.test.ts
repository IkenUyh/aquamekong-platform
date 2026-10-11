import { describe, expect, it } from 'vitest';
import { watchStatus } from './watchStatus';
import type { StationWatch } from '../api/watchApi';

const watch = (outlook: Partial<StationWatch['outlook']>): StationWatch => ({
  id: 1, stationId: 3, stationName: 'Mỹ Tho', threshold: 2, crop: 'Lúa',
  outlook: {
    latestSalinity: null, latestAt: null, firstExceedDate: null, forecastMax: null,
    firstRiskDate: null, riskMax: null, riskUntil: null, exceeding: false, ...outlook,
  },
});

describe('watchStatus', () => {
  it('reports a current reading above the threshold first', () => {
    const s = watchStatus(watch({ latestSalinity: 2.5, latestAt: new Date(2026, 9, 8).toISOString(), exceeding: true }));
    expect(s).toEqual({ text: 'Đang vượt ngưỡng: 2,50‰ ngày 08/10', exceeding: true });
  });

  it('gives the first forecast day above the threshold', () => {
    const s = watchStatus(watch({ latestSalinity: 1.2, firstExceedDate: '2026-10-12', forecastMax: 2.9, exceeding: true }));
    expect(s.text).toBe('Dự báo vượt ngưỡng từ ngày 12/10, cao nhất 2,90‰');
  });

  it('warns about a risk before the forecast itself crosses the threshold', () => {
    const s = watchStatus(watch({ latestSalinity: 1.2, forecastMax: 1.2, firstRiskDate: '2026-10-11', riskMax: 2.6, riskUntil: '2026-10-13', exceeding: true }));
    expect(s).toEqual({ text: 'Có thể vượt ngưỡng từ ngày 11/10 (có thể lên tới 2,60‰)', exceeding: true });
  });

  it('keeps a risk warning until the flagged day has passed', () => {
    const s = watchStatus(watch({ latestSalinity: 1.2, forecastMax: 1.2, riskMax: 1.6, riskUntil: '2026-10-13', exceeding: true }));
    expect(s.text).toBe('Còn nguy cơ vượt ngưỡng tới hết ngày 13/10');
  });

  it('shows the risk level instead of the flat forecast when below', () => {
    expect(watchStatus(watch({ latestSalinity: 1.2, forecastMax: 1.2, riskMax: 1.7 })).text).toBe('Dưới ngưỡng (mới nhất 1,20‰, có thể lên tới 1,70‰)');
  });

  it('shows the latest reading and forecast peak when below', () => {
    expect(watchStatus(watch({ latestSalinity: 1.2, forecastMax: 1.5 })).text).toBe('Dưới ngưỡng (mới nhất 1,20‰, dự báo cao nhất 1,50‰)');
    expect(watchStatus(watch({})).text).toBe('Chưa có số đo gần đây');
  });
});
