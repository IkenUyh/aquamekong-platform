import { useQuery } from '@tanstack/react-query';
import { metricApi } from '../api/client';
import type { MetricType } from '../types';

export function useFilteredMetrics(stationId: number | null, startDate: Date, endDate: Date, metricType: MetricType = 'salinity') {
  return useQuery({
    queryKey: ['metrics', 'filtered', stationId, metricType, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => metricApi.getByStationWithDateRange(
      stationId!,
      startDate.toISOString(),
      endDate.toISOString(),
      metricType
    ),
    enabled: stationId !== null,
    staleTime: 30000,
  });
}
