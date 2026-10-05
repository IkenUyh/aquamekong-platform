import { useQuery } from '@tanstack/react-query';
import { forecastApi } from '../api/client';

export const forecastQueryKey = (stationId: number | null, daysAhead: number) => ['forecast', stationId, daysAhead];

/** Dự báo `daysAhead` ngày tới của trạm (tự chạy ML nếu chưa có / đã cũ). */
export function useForecast(stationId: number | null, daysAhead = 7) {
  return useQuery({
    queryKey: forecastQueryKey(stationId, daysAhead),
    queryFn: () => forecastApi.getOrPredict(stationId!, daysAhead),
    enabled: stationId !== null,
    staleTime: 10 * 60_000,
  });
}
