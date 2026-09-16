import apiClient, { withFallback } from './client';
import { MOCK_RECOMMENDATIONS } from '../data/mockData';

export interface RecommendationDto {
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  icon: string;
}

export const recommendationApi = {
  getRecommendations: () =>
    withFallback(
      apiClient.get<RecommendationDto[]>('/recommendations').then((r) => r.data),
      MOCK_RECOMMENDATIONS as RecommendationDto[]
    ),
};
