import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fieldApi, type FieldRequest, type QuickPlanQuery } from '../api/fieldApi';
import { useAuth } from '../contexts/AuthContext';

const FIELDS_KEY = ['fields'];

/**
 * Hồ sơ ruộng dùng chung toàn server, không cần đăng nhập. Key có tài khoản đang xem vì "ruộng của bạn" (mine) đổi
 * khi đăng nhập/đăng xuất.
 */
export function useFields(enabled = true) {
  const { user } = useAuth();
  return useQuery({ queryKey: [...FIELDS_KEY, user?.username ?? null], queryFn: fieldApi.list, enabled });
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
      // Khuyến nghị của người đã đăng nhập lập theo ruộng của họ
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });
}

/** Mức mặn cây đã chịu trong mùa và năng suất có thể giảm. Key nằm dưới ['fields'] nên sửa ruộng thì tính lại. */
export function useFieldExposure(id: number | null) {
  return useQuery({
    queryKey: [...FIELDS_KEY, 'exposure', id],
    queryFn: () => fieldApi.exposure(id as number),
    enabled: id != null,
    staleTime: 10 * 60_000,
  });
}

/** Kế hoạch nước 7 ngày tới (ngày lấy được nước sông, tỷ lệ pha, ao đủ bao lâu). Key dưới ['fields'] như exposure. */
export function useFieldWaterPlan(id: number | null) {
  return useQuery({
    queryKey: [...FIELDS_KEY, 'water-plan', id],
    queryFn: () => fieldApi.waterPlan(id as number),
    enabled: id != null,
    staleTime: 10 * 60_000,
  });
}

/** Việc cần làm có ngày và câu trả lời "Tuần này lấy nước được không?". Key dưới ['fields'] như water-plan. */
export function useFieldPlan(id: number | null) {
  return useQuery({
    queryKey: [...FIELDS_KEY, 'plan', id],
    queryFn: () => fieldApi.plan(id as number),
    enabled: id != null,
    staleTime: 10 * 60_000,
  });
}

/** Chế độ Nông dân: kế hoạch theo trạm + cây, không lưu ruộng. null tắt truy vấn. */
export function useQuickPlan(q: QuickPlanQuery | null) {
  return useQuery({
    queryKey: ['plan-quick', q?.stationId ?? null, q?.cropCode ?? null, q?.plantedOn ?? null, q?.varietyDays ?? null],
    queryFn: () => fieldApi.quickPlan(q as QuickPlanQuery),
    enabled: q != null,
    staleTime: 10 * 60_000,
  });
}

export function useRemoveField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fieldApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FIELDS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['watches'] });
      // Khuyến nghị của người đã đăng nhập lập theo ruộng của họ
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });
}
