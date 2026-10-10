import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { watchApi, type WatchRequest } from '../api/watchApi';
import { useAuth } from '../contexts/AuthContext';

const WATCHES_KEY = ['watches'];

/** Trạm theo dõi của tài khoản đang đăng nhập */
export function useWatches() {
  const { user } = useAuth();
  return useQuery({ queryKey: WATCHES_KEY, queryFn: watchApi.list, enabled: !!user });
}

export function useSaveWatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: WatchRequest) => watchApi.save(req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WATCHES_KEY }),
  });
}

export function useRemoveWatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => watchApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WATCHES_KEY }),
  });
}
