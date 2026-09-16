import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { MetricCard } from './MetricCard';
import type { AxiosResponse } from 'axios';

interface MetricSummaryDto {
  rainfall?: number;
  rainfallDeltaPercent?: number;
  rainfallPeriod?: string;
  flowRate?: number;
  flowRateDeltaPercent?: number;
  flowRateStation?: string;
  waterLevel?: number;
  waterLevelDelta?: number;
  waterLevelStation?: string;
}

export function SummaryMetricCards() {
  const { data: summary } = useQuery({
    queryKey: ['metrics', 'summary'],
    queryFn: () => Promise.resolve({
      rainfall: 12.5, rainfallDeltaPercent: 5.2, rainfallPeriod: "24 giờ qua",
      flowRate: 2450.0, flowRateDeltaPercent: -2.1, flowRateStation: "Vàm Cỏ",
      waterLevel: 1.45, waterLevelDelta: 0.12, waterLevelStation: "Vàm Cỏ"
    } as MetricSummaryDto),
    refetchInterval: 30000,
  });

  if (!summary) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
      <h3 className="font-semibold text-gray-800 text-sm mb-3">Thông số tổng hợp</h3>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label="Lượng mưa"
          value={summary.rainfall?.toFixed(1) ?? '—'}
          unit="mm"
          icon={<span className="text-blue-500 font-bold">🌧</span>}
          delta={summary.rainfallDeltaPercent}
          deltaType="percent"
          deltaLabel="24h"
          subtitle={summary.rainfallPeriod}
        />
        <MetricCard
          label="Lưu lượng"
          value={summary.flowRate?.toLocaleString() ?? '—'}
          unit="m³/s"
          icon={<span className="text-teal-500 font-bold">💨</span>}
          delta={summary.flowRateDeltaPercent}
          deltaType="percent"
          deltaLabel="24h"
          subtitle={summary.flowRateStation}
        />
        <MetricCard
          label="Mực nước"
          value={summary.waterLevel?.toFixed(2) ?? '—'}
          unit="m"
          icon={<span className="text-indigo-500 font-bold">🌊</span>}
          delta={summary.waterLevelDelta}
          deltaType="absolute"
          deltaLabel="24h"
          subtitle={summary.waterLevelStation}
        />
      </div>
    </div>
  );
}
