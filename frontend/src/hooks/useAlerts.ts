import { useQuery } from '@tanstack/react-query';
import { alertApi } from '../api/alertApi';

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts', 'recent'],
    queryFn: alertApi.getRecent,
    refetchInterval: 30000,
  });
}

export function useUnresolvedAlerts() {
  return useQuery({
    queryKey: ['alerts', 'unresolved'],
    queryFn: alertApi.getUnresolved,
    refetchInterval: 15000,
  });
}
