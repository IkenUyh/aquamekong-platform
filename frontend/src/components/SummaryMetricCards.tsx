import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from './MetricCard';
import { reportApi, percentChange } from '../api/reportApi';

/** Trung bình toàn vùng 24h qua, so với 24h trước đó (GET /reports/overview?days=1). */
export function SummaryMetricCards() {
  const { data: summary } = useQuery({
    queryKey: ['reports', 'overview', 1],
    queryFn: () => reportApi.getOverview(1),
    refetchInterval: 60_000,
  });

  if (!summary) return null;

  const waterLevelDelta =
    summary.avgWaterLevel.current != null && summary.avgWaterLevel.previous != null
      ? Math.round((summary.avgWaterLevel.current - summary.avgWaterLevel.previous) * 100) / 100
      : undefined;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
      <h3 className="font-semibold text-gray-800 text-sm mb-3">Thông số tổng hợp (24 giờ qua)</h3>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label="Độ mặn"
          value={summary.avgSalinity.current?.toFixed(2) ?? '—'}
          unit="‰"
          icon={<span className="text-blue-500 font-bold">💧</span>}
          delta={percentChange(summary.avgSalinity) ?? undefined}
          deltaType="percent"
          deltaLabel="24h"
          subtitle="Trung bình toàn vùng"
        />
        <MetricCard
          label="Lưu lượng"
          value={summary.avgFlowRate.current?.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) ?? '—'}
          unit="m³/s"
          icon={<span className="text-teal-500 font-bold">💨</span>}
          delta={percentChange(summary.avgFlowRate) ?? undefined}
          deltaType="percent"
          deltaLabel="24h"
          subtitle="Trung bình toàn vùng"
        />
        <MetricCard
          label="Mực nước"
          value={summary.avgWaterLevel.current?.toFixed(2) ?? '—'}
          unit="m"
          icon={<span className="text-indigo-500 font-bold">🌊</span>}
          delta={waterLevelDelta}
          deltaType="absolute"
          deltaLabel="24h"
          subtitle="Trung bình toàn vùng"
        />
      </div>
    </div>
  );
}
