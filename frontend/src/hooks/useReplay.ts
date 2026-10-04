import { useQuery } from '@tanstack/react-query';
import { replayApi } from '../api/replayApi';

export function useReplayBounds() {
  return useQuery({ queryKey: ['replay', 'bounds'], queryFn: replayApi.getBounds, staleTime: 10 * 60_000 });
}

/** Dữ liệu lịch sử không đổi khi đang xem, nên không cần refetch */
export function useReplay(from: string | undefined, to: string | undefined) {
  return useQuery({
    queryKey: ['replay', from, to],
    queryFn: () => replayApi.getReplay(from!, to!),
    enabled: !!from && !!to,
    staleTime: Infinity,
  });
}
