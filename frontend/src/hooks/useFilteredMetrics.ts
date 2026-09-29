import { useQuery } from '@tanstack/react-query';
import { metricApi } from '../api/client';

export function useFilteredMetrics(stationId: number | null, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['metrics', 'filtered', stationId, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => metricApi.getByStationWithDateRange(
      stationId!,
      startDate.toISOString(),
      endDate.toISOString()
    ),
    enabled: stationId !== null,
    staleTime: 30000,
  });
}
