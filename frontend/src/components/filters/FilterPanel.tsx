import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { DateRangeFilter } from './DateRangeFilter';
import { StationDropdown } from './StationDropdown';
import { MapLayerToggles, DEFAULT_LAYERS } from './MapLayerToggles';
import { useFilters } from '../../contexts/FilterContext';
import { useStationsList } from '../../hooks/useStations';

export function FilterPanel() {
  const { startDate, endDate, setDateRange,
          selectedStationId, setSelectedStation,
          activeLayers, toggleLayer } = useFilters();

  const { data: stations } = useStationsList();

  const layers = DEFAULT_LAYERS.map(l => ({
    ...l,
    enabled: activeLayers[l.id] ?? l.enabled,
  }));

  return (
    <div className="p-4 space-y-5 border-b border-gray-200">
      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4" />
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

      {/* Map layers */}
      <MapLayerToggles
        layers={layers}
        onToggle={toggleLayer}
      />
    </div>
  );
}
