import React from 'react';
import { useForecast } from '../hooks/useForecast';
import { ForecastSummaryPanel } from './ForecastSummaryPanel';
import { ForecastChart } from './ForecastChart';
import { RecommendationPanel } from './RecommendationPanel';
import { AlertPanel } from './AlertPanel';
import { SummaryMetricCards } from './SummaryMetricCards';

/** Panel phải trang Bản đồ: khuyến nghị, cảnh báo, chỉ số chung luôn hiện; dự báo khi đã chọn trạm. */
export function RightPanel({ stationId }: { stationId: number | null }) {
  const { data: forecasts = [], isLoading } = useForecast(stationId);

  return (
    <>
      <RecommendationPanel />
      <AlertPanel />

      {stationId === null ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 text-center">
          Chọn một trạm trên bản đồ để xem dự báo
        </div>
      ) : isLoading ? (
        <div className="text-sm text-gray-500 text-center">Đang tải dự báo...</div>
      ) : forecasts.length > 0 ? (
        <>
          <ForecastSummaryPanel forecasts={forecasts} />
          <div className="card p-4 mb-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-3">Dự báo độ mặn</h3>
            <ForecastChart forecasts={forecasts} />
          </div>
        </>
      ) : null}

      <SummaryMetricCards />
    </>
  );
}
