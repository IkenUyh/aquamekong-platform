import { useQuery } from '@tanstack/react-query';
import { recommendationApi } from '../api/recommendationApi';
import { useAuth } from '../contexts/AuthContext';

/**
 * Khuyến nghị vận hành. Đã đăng nhập và có ruộng thì backend trả việc cần làm của từng ruộng, nên key có tài khoản:
 * đăng nhập/đăng xuất không hiện khuyến nghị của người trước.
 */
export function useRecommendations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recommendations', user?.username ?? null],
    queryFn: recommendationApi.getRecommendations,
    refetchInterval: 60000,
  });
}
