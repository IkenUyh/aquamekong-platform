import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from './MetricCard';
import { reportApi, percentChange } from '../api/reportApi';
import { formatNumber } from '../utils/salinity';

/** Trung bình toàn vùng 24h qua, so với 24h trước đó (GET /reports/overview?days=1). */
export function SummaryMetricCards() {
  const { data: summary } = useQuery({
    queryKey: ['reports', 'overview', 1],
    queryFn: () => reportApi.getOverview(1),
    refetchInterval: 60_000,
  });

  if (!summary) return null;

  const salinityChange = percentChange(summary.avgSalinity);
  const flowChange = percentChange(summary.avgFlowRate);
  const waterLevelDelta =
    summary.avgWaterLevel.current != null && summary.avgWaterLevel.previous != null
      ? summary.avgWaterLevel.current - summary.avgWaterLevel.previous
      : null;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900">Trung bình toàn vùng</h3>
      <p className="text-xs text-gray-500 mb-3">24 giờ qua, so với 24 giờ trước đó</p>
      <div className="grid grid-cols-1 gap-2">
        <MetricCard label="Độ mặn" value={formatNumber(summary.avgSalinity.current)} unit="‰"
          change={salinityChange != null ? { value: salinityChange, kind: '%', upIsBad: true } : undefined} />
        <MetricCard label="Lưu lượng" value={formatNumber(summary.avgFlowRate.current, 0)} unit="m³/s"
          change={flowChange != null ? { value: flowChange, kind: '%' } : undefined} />
        <MetricCard label="Mực nước" value={formatNumber(summary.avgWaterLevel.current)} unit="m"
          change={waterLevelDelta != null ? { value: waterLevelDelta, kind: 'abs' } : undefined} />
      </div>
    </div>
  );
}
