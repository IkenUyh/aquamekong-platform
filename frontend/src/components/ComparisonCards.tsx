import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCompareCard } from './MetricCompareCard';
import { metricApi } from '../api/client';
import { SALINITY_THRESHOLD, formatNumber } from '../utils/salinity';

interface ComparisonCardsProps {
  stationId: number;
  currentSalinity: number | null;
  threshold?: number;
}

const HOUR = 3600_000;

/** Độ mặn hiện tại so với ~24h trước và so với ngưỡng. */
export function ComparisonCards({ stationId, currentSalinity, threshold = SALINITY_THRESHOLD }: ComparisonCardsProps) {
  // Số đo độ mặn gần mốc 24h trước nhất (trong cửa sổ 23h–25h)
  const { data: around24hAgo = [] } = useQuery({
    queryKey: ['metrics', 'salinity-24h-ago', stationId],
    queryFn: () => {
      const now = Date.now();
      return metricApi.getByStationWithDateRange(
        stationId,
        new Date(now - 25 * HOUR).toISOString(),
        new Date(now - 23 * HOUR).toISOString(),
        'salinity'
      );
    },
    staleTime: 5 * 60_000,
  });

  const value24hAgo = around24hAgo[0]?.value;
  const delta24h = currentSalinity != null && value24hAgo != null ? currentSalinity - value24hAgo : null;
  const deltaThreshold = currentSalinity != null ? currentSalinity - threshold : null;

  return (
    <div className="flex flex-col gap-2 p-4 h-full justify-center">
      <MetricCompareCard
        label="Độ mặn hiện tại"
        value={`${formatNumber(currentSalinity)}‰`}
      />
      <MetricCompareCard
        label="So với 24h trước"
        value={delta24h !== null ? `${delta24h > 0 ? '↑' : '↓'} ${formatNumber(Math.abs(delta24h))}‰` : '—'}
        trend={delta24h !== null ? (delta24h > 0 ? 'up' : 'down') : 'neutral'}
      />
      <MetricCompareCard
        label={`So với ngưỡng ${threshold}‰`}
        value={deltaThreshold !== null ? `${deltaThreshold > 0 ? '↑' : '↓'} ${formatNumber(Math.abs(deltaThreshold))}‰` : '—'}
        trend={deltaThreshold !== null ? (deltaThreshold > 0 ? 'up' : 'down') : 'neutral'}
      />
    </div>
  );
}
