import { useQuery } from '@tanstack/react-query';
import { cropApi } from '../api/cropApi';

/** Bảng cây trồng và ngưỡng mặn (ít khi đổi: chỉ đổi khi có migration mới) */
export function useCrops() {
  return useQuery({ queryKey: ['crops'], queryFn: cropApi.list, staleTime: 60 * 60 * 1000 });
}
