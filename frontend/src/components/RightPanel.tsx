import React from 'react';
import { useForecast } from '../hooks/useForecast';
import { ForecastSummaryPanel } from './ForecastSummaryPanel';
import { ForecastChart } from './ForecastChart';
import { RecommendationPanel } from './RecommendationPanel';
import { AlertPanel } from './AlertPanel';
import { SummaryMetricCards } from './SummaryMetricCards';

export function RightPanel({ stationId }: { stationId: number | null }) {
  const { data: forecasts, isLoading } = useForecast(stationId);

  if (isLoading) {
    return <div className="text-sm text-gray-500 text-center">Đang tải dự báo...</div>;
  }

  if (!stationId) {
    return <div className="text-sm text-gray-500 text-center">Vui lòng chọn trạm để xem dự báo</div>;
  }

  return (
    <>
      {/* Recommendation Panel */}
      <RecommendationPanel />

      {/* Alert Panel */}
      <AlertPanel />

      {/* Forecast Summary */}
      {forecasts && forecasts.length > 0 && (
        <ForecastSummaryPanel forecasts={forecasts} />
      )}

      {/* Small Forecast Chart */}
      {forecasts && forecasts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">
            Dự báo độ mặn
          </h3>
          <ForecastChart forecasts={forecasts} />
        </div>
      )}

      {/* Summary Metric Cards */}
      <SummaryMetricCards />
    </>
  );
}
