import apiClient, { withFallback } from './client';
import { MOCK_RECOMMENDATIONS } from '../data/mockData';

export interface RecommendationDto {
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  /** Khuyến nghị theo ruộng (đã đăng nhập và có ruộng): message bắt đầu bằng "Tên ruộng (cây): " */
  fieldId?: number;
  fieldName?: string;
  /** YYYY-MM-DD */
  from?: string;
  until?: string;
}

export const recommendationApi = {
  getRecommendations: () =>
    withFallback(
      apiClient.get<RecommendationDto[]>('/recommendations').then((r) => r.data),
      MOCK_RECOMMENDATIONS as RecommendationDto[]
    ),
};
