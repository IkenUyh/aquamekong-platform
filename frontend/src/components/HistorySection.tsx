import React from 'react';
import { HistoryChart } from './HistoryChart';
import { ComparisonCards } from './ComparisonCards';
import { useFilteredMetrics } from '../hooks/useFilteredMetrics';
import { useStationsList } from '../hooks/useStations';
import { useFilters } from '../contexts/FilterContext';

export function HistorySection({ stationId }: { stationId: number }) {
  const { startDate, endDate } = useFilters();
  const { data: metrics, isLoading: isLoadingMetrics } = useFilteredMetrics(stationId, startDate, endDate);
  const { data: stationsList } = useStationsList();
  
  const station = stationsList?.find((s: any) => s.id === stationId);

  if (isLoadingMetrics || !metrics || !station) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Đang tải dữ liệu...
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 h-full overflow-hidden">
        <HistoryChart metrics={metrics} stationName={station.name} />
      </div>
      <div className="w-[280px] border-l border-gray-200 h-full overflow-y-auto">
        <ComparisonCards
          currentSalinity={station.latestSalinity ?? 0}
          metrics={metrics}
        />
      </div>
    </div>
  );
}
