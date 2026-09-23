import React from 'react';
import { Droplets } from 'lucide-react';
import { MetricCompareCard } from './MetricCompareCard';
import type { WaterMetric } from '../types';

interface ComparisonCardsProps {
  currentSalinity: number;
  metrics: WaterMetric[];
  threshold?: number;
}

export function ComparisonCards({ currentSalinity, metrics, threshold = 4 }: ComparisonCardsProps) {
  // Tính delta 24h — lấy metric cách đây ~24h
  const now = new Date();
  const metric24hAgo = metrics.find(m => {
    const diff = now.getTime() - new Date(m.recordedAt).getTime();
    return diff >= 23 * 3600000 && diff <= 25 * 3600000;
  });
  
  const delta24h = metric24hAgo ? currentSalinity - (metric24hAgo.salinity ?? metric24hAgo.value ?? 0) : null;
  const deltaThreshold = currentSalinity - threshold;

  return (
    <div className="flex flex-col gap-2 p-4 h-full justify-center">
      <MetricCompareCard
        label="Độ mặn hiện tại"
        value={`${currentSalinity}‰`}
        icon={<Droplets size={14} />}
      />
      <MetricCompareCard
        label="So với 24h trước"
        value={delta24h !== null ? `${delta24h > 0 ? '↑' : '↓'} ${Math.abs(delta24h).toFixed(1)}‰` : '—'}
        trend={delta24h !== null ? (delta24h > 0 ? 'up' : 'down') : 'neutral'}
      />
      <MetricCompareCard
        label="So với ngưỡng"
        value={`${deltaThreshold > 0 ? '↑' : '↓'} ${Math.abs(deltaThreshold).toFixed(1)}‰`}
        trend={deltaThreshold > 0 ? 'up' : 'down'}
      />
    </div>
  );
}
