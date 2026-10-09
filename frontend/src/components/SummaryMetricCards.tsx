import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from './MetricCard';
import { reportApi, percentChange } from '../api/reportApi';
import { formatNumber } from '../utils/salinity';

/** Trung bình toàn vùng 7 ngày qua, so với 7 ngày trước đó (GET /reports/overview?days=7). Số đo theo ngày. */
export function SummaryMetricCards() {
  const { data: summary } = useQuery({
    queryKey: ['reports', 'overview', 7],
    queryFn: () => reportApi.getOverview(7),
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
      <p className="text-xs text-gray-500 mb-3">7 ngày qua, so với 7 ngày trước đó</p>
      <div className="grid grid-cols-1 gap-2">
        <MetricCard label="Độ mặn" value={formatNumber(summary.avgSalinity.current, 2, true)} unit="‰"
          change={salinityChange != null ? { value: salinityChange, kind: '%', upIsBad: true } : undefined} />
        {/* Dữ liệu RYNAN không đo lưu lượng: ô luôn trống thì ẩn */}
        {(summary.avgFlowRate.current != null || summary.avgFlowRate.previous != null) && (
          <MetricCard label="Lưu lượng" value={formatNumber(summary.avgFlowRate.current, 0)} unit="m³/s"
            change={flowChange != null ? { value: flowChange, kind: '%' } : undefined} />
        )}
        <MetricCard label="Mực nước" value={formatNumber(summary.avgWaterLevel.current, 2, true)} unit="m"
          change={waterLevelDelta != null ? { value: waterLevelDelta, kind: 'abs' } : undefined} />
      </div>
    </div>
  );
}
