import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCompareCard } from './MetricCompareCard';
import { metricApi } from '../api/client';
import { SALINITY_THRESHOLD, formatMeasuredAt, formatNumber } from '../utils/salinity';

interface ComparisonCardsProps {
  stationId: number;
  currentSalinity: number | null;
  threshold?: number;
}

const DAY = 24 * 3600_000;

/** Độ mặn hiện tại so với lần đo trước đó (số liệu RYNAN theo ngày, nên thường là hôm trước) và so với ngưỡng. */
export function ComparisonCards({ stationId, currentSalinity, threshold = SALINITY_THRESHOLD }: ComparisonCardsProps) {
  const { data: recent = [] } = useQuery({
    queryKey: ['metrics', 'salinity-recent', stationId],
    queryFn: () => {
      const now = Date.now();
      return metricApi.getByStationWithDateRange(stationId, new Date(now - 10 * DAY).toISOString(), new Date(now).toISOString(), 'salinity');
    },
    staleTime: 5 * 60_000,
  });

  // API trả mới nhất trước: [0] là số đo hiện tại, [1] là lần đo trước
  const previous = recent[1];
  const delta = currentSalinity != null && previous ? currentSalinity - previous.value : null;
  const deltaThreshold = currentSalinity != null ? currentSalinity - threshold : null;

  return (
    <div className="flex flex-col gap-2 p-4 h-full justify-center">
      <MetricCompareCard
        label="Độ mặn hiện tại"
        value={`${formatNumber(currentSalinity)}‰`}
      />
      <MetricCompareCard
        label={previous ? `So với ${formatMeasuredAt(previous.recordedAt)}` : 'So với lần đo trước'}
        value={delta !== null ? `${delta > 0 ? '↑' : '↓'} ${formatNumber(Math.abs(delta))}‰` : '—'}
        trend={delta !== null ? (delta > 0 ? 'up' : 'down') : 'neutral'}
      />
      <MetricCompareCard
        label={`So với ngưỡng ${threshold}‰`}
        value={deltaThreshold !== null ? `${deltaThreshold > 0 ? '↑' : '↓'} ${formatNumber(Math.abs(deltaThreshold))}‰` : '—'}
        trend={deltaThreshold !== null ? (deltaThreshold > 0 ? 'up' : 'down') : 'neutral'}
      />
    </div>
  );
}
