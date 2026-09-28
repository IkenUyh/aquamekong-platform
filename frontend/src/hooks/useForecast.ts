import { useQuery } from '@tanstack/react-query';
import { forecastApi } from '../api/client';

export function useForecast(stationId: number | null) {
  return useQuery({
    queryKey: ['forecast', stationId],
    queryFn: () => forecastApi.getByStation(stationId!),
    enabled: stationId !== null,
    staleTime: 60000,
  });
}
