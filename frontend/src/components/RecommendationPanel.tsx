import React from 'react';
import { useRecommendations } from '../hooks/useRecommendations';
import { isPersonal } from '../utils/actionPlan';
import { RecommendationList } from './RecommendationList';

export function RecommendationPanel() {
  const { data: recommendations } = useRecommendations();

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        {isPersonal(recommendations) ? 'Việc cần làm cho ruộng của bạn' : 'Khuyến nghị vận hành'}
      </h3>
      <RecommendationList items={recommendations} />
    </div>
  );
}
