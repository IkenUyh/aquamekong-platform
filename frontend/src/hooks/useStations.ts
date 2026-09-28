import { useQuery } from '@tanstack/react-query';
import { stationApi } from '../api/client';

export function useStations() {
  return useQuery({
    queryKey: ['stations'],
    queryFn: stationApi.getAll,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000,
  });
}

export function useStationsList() {
  return useQuery({
    queryKey: ['stations', 'list'],
    queryFn: stationApi.getAllList,
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function useStation(id: number | null) {
  return useQuery({
    queryKey: ['station', id],
    queryFn: () => stationApi.getById(id!),
    enabled: id !== null,
  });
}
