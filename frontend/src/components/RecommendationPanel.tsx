import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { recommendationApi } from '../api/recommendationApi';
import { RecommendationList } from './RecommendationList';

export function RecommendationPanel() {
  const { data: recommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: recommendationApi.getRecommendations,
    refetchInterval: 60000,
  });

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Khuyến nghị vận hành</h3>
      <RecommendationList items={recommendations} />
    </div>
  );
}
