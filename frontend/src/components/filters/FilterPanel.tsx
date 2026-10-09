import React, { useEffect } from 'react';
import { DateRangeFilter } from './DateRangeFilter';
import { StationDropdown } from './StationDropdown';
import { MapLayerToggles, DEFAULT_LAYERS } from './MapLayerToggles';
import { ColorMetricPicker } from './ColorMetricPicker';
import { useFilters } from '../../contexts/FilterContext';
import { useStationsList } from '../../hooks/useStations';
import { COLOR_METRICS, METRIC_SCALES } from '../../utils/metricScales';

export function FilterPanel() {
  const { startDate, endDate, setDateRange,
          selectedStationId, setSelectedStation,
          activeLayers, toggleLayer, colorMetric, setColorMetric } = useFilters();

  const { data: stations } = useStationsList();
  // Chỉ số không trạm nào có số đo (vd. lưu lượng với dữ liệu RYNAN) thì tô màu chỉ ra toàn xám: ẩn đi
  const metrics = COLOR_METRICS.filter((m) => m === 'salinity' || stations?.some((s) => METRIC_SCALES[m].value(s) != null));
  const colorMetricAvailable = !stations || metrics.includes(colorMetric);
  useEffect(() => {
    if (!colorMetricAvailable) setColorMetric('salinity');
  }, [colorMetricAvailable, setColorMetric]);

  const layers = DEFAULT_LAYERS.map(l => ({
    ...l,
    enabled: activeLayers[l.id] ?? l.enabled,
  }));

  return (
    <div className="p-4 space-y-5 border-b border-gray-200">
      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
        Bộ lọc & điều khiển
      </h3>

      {/* Date range */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onChange={setDateRange}
      />

      {/* Station dropdown */}
      <StationDropdown
        stations={stations ?? []}
        selectedId={selectedStationId}
        onChange={setSelectedStation}
      />

      <ColorMetricPicker value={colorMetric} onChange={setColorMetric} metrics={metrics} />

      {/* Map layers */}
      <MapLayerToggles
        layers={layers}
        onToggle={toggleLayer}
      />
    </div>
  );
}
