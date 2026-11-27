import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fieldApi, type FieldRequest } from '../api/fieldApi';
import { useAuth } from '../contexts/AuthContext';

const FIELDS_KEY = ['fields'];

/** Hồ sơ ruộng của tài khoản đang đăng nhập */
export function useFields() {
  const { user } = useAuth();
  return useQuery({ queryKey: FIELDS_KEY, queryFn: fieldApi.list, enabled: !!user });
}

/** Lưu ruộng (tạo khi không có id); ruộng tự theo dõi trạm nên làm mới cả danh sách trạm theo dõi */
export function useSaveField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, req }: { id: number | null; req: FieldRequest }) =>
      id == null ? fieldApi.create(req) : fieldApi.update(id, req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FIELDS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['watches'] });
    },
  });
}

export function useRemoveField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fieldApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FIELDS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['watches'] });
    },
  });
}
