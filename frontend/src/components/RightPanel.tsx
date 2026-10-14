import React from 'react';
import { useForecast } from '../hooks/useForecast';
import { useStationsList } from '../hooks/useStations';
import { formatMeasuredAt, isReporting } from '../utils/salinity';
import { ForecastSummaryPanel } from './ForecastSummaryPanel';
import { ForecastChart } from './ForecastChart';
import { RecommendationPanel } from './RecommendationPanel';
import { AlertPanel } from './AlertPanel';
import { SummaryMetricCards } from './SummaryMetricCards';

/** Panel phải trang Bản đồ: khuyến nghị, cảnh báo, chỉ số chung luôn hiện; dự báo khi đã chọn trạm. */
export function RightPanel({ stationId }: { stationId: number | null }) {
  const { data: stations = [] } = useStationsList();
  const station = stations.find((s) => s.id === stationId);
  // Trạm mất tín hiệu không dự báo (ml-service cũng từ chối): không lấy lượt dự báo cũ đã lưu
  const silent = !!station && !isReporting(station.lastMeasuredAt);
  const { data: forecasts = [], isLoading } = useForecast(silent ? null : stationId);
  const stationName = station?.name;

  return (
    <>
      <RecommendationPanel />
      <AlertPanel />

      {stationId === null ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 text-center">
          Chọn một trạm trên bản đồ để xem dự báo
        </div>
      ) : silent ? (
        <div className="card p-4 mb-4 text-sm text-gray-600">
          <span className="font-medium text-gray-900">{stationName}</span> mất tín hiệu
          {station?.lastMeasuredAt && <>, số đo cuối {formatMeasuredAt(station.lastMeasuredAt)}</>}. Không dự báo khi trạm
          không có số đo mới trong 3 ngày.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-gray-500 text-center">Đang tải dự báo...</div>
      ) : forecasts.length > 0 ? (
        <>
          <ForecastSummaryPanel forecasts={forecasts} stationName={stationName} />
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
