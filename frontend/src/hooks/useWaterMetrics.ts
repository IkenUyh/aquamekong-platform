import { useQuery } from '@tanstack/react-query';
import { metricApi } from '../api/client';

export function useLatestMetrics() {
  return useQuery({
    queryKey: ['metrics', 'latest'],
    queryFn: metricApi.getLatest,
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useStationMetrics(stationId: number | null) {
  return useQuery({
    queryKey: ['metrics', 'station', stationId],
    queryFn: () => metricApi.getByStation(stationId!),
    enabled: stationId !== null,
  });
}
