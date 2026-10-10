import { describe, expect, it } from 'vitest';
import { watchStatus } from './watchStatus';
import type { StationWatch } from '../api/watchApi';

const watch = (outlook: Partial<StationWatch['outlook']>): StationWatch => ({
  id: 1, stationId: 3, stationName: 'Mỹ Tho', threshold: 2, crop: 'Lúa',
  outlook: { latestSalinity: null, latestAt: null, firstExceedDate: null, forecastMax: null, exceeding: false, ...outlook },
});

describe('watchStatus', () => {
  it('reports a current reading above the threshold first', () => {
    const s = watchStatus(watch({ latestSalinity: 2.5, latestAt: new Date(2026, 9, 8).toISOString(), exceeding: true }));
    expect(s).toEqual({ text: 'Đang vượt ngưỡng: 2,5‰ ngày 08-10', exceeding: true });
  });

  it('gives the first forecast day above the threshold', () => {
    const s = watchStatus(watch({ latestSalinity: 1.2, firstExceedDate: '2026-10-12', forecastMax: 2.9, exceeding: true }));
    expect(s.text).toBe('Dự báo vượt ngưỡng từ ngày 12-10, cao nhất 2,9‰');
  });

  it('shows the latest reading and forecast peak when below', () => {
    expect(watchStatus(watch({ latestSalinity: 1.2, forecastMax: 1.5 })).text).toBe('Dưới ngưỡng (mới nhất 1,2‰, dự báo cao nhất 1,5‰)');
    expect(watchStatus(watch({})).text).toBe('Chưa có số đo gần đây');
  });
});
