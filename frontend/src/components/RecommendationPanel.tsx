import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { recommendationApi } from '../api/recommendationApi';

export interface RecommendationDto {
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  icon: string;
}

export function RecommendationPanel() {
  const { data: recommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: recommendationApi.getRecommendations,
    refetchInterval: 60000,
  });

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          Khuyến nghị AI
          <span className="text-sm">🤖</span>
        </h3>
        <a href="#recommendations" className="text-blue-500 text-xs hover:underline">Chi tiết &gt;</a>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec: RecommendationDto, i: number) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 transition-all hover:bg-blue-100/50">
            <span className="text-2xl leading-none mt-1">{rec.icon || '💡'}</span>
            <div>
              <p className="text-sm text-gray-700 leading-snug">{rec.message}</p>
              <span className={`text-xs font-medium mt-1 inline-block px-2 py-0.5 rounded-full
                ${rec.priority === 'HIGH' ? 'bg-red-100 text-red-600' :
                  rec.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-green-100 text-green-600'}`}>
                {rec.priority === 'HIGH' ? 'Ưu tiên cao' :
                 rec.priority === 'MEDIUM' ? 'Trung bình' : 'Tham khảo'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
