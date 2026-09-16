import React, { useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { MapView } from '../components/MapView';
import { useStations, useStationsList } from '../hooks/useStations';
import { useTelemetrySSE } from '../hooks/useTelemetrySSE';
import { HistorySection } from '../components/HistorySection';
import { RightPanel } from '../components/RightPanel';
import { queryClient } from '../App';
import type { GeoJsonFeature } from '../types';
import { FilterProvider, useFilters } from '../contexts/FilterContext';
import { FilterPanel } from '../components/filters/FilterPanel';

function MapPageContent() {
  const { selectedStationId, setSelectedStation, activeLayers } = useFilters();
  const { data: geoJson } = useStations();
  const { data: stationsList } = useStationsList();

  const { isConnected } = useTelemetrySSE({
    onTelemetry: useCallback((_data: any) => {
      queryClient.invalidateQueries({ queryKey: ['stations'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    }, []),
  });

  const features: GeoJsonFeature[] = geoJson?.features ?? [];

  return (
    <DashboardLayout
      leftPanel={
        <div className="h-full flex flex-col bg-white">
          <FilterPanel />
          <div className="p-4 flex-1 overflow-y-auto">
            <h2 className="font-semibold text-gray-700 mb-4">Danh sách trạm</h2>
            <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
              Trạng thái kết nối:
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </div>
            <div className="space-y-2">
              {stationsList?.map(station => (
                <div 
                  key={station.id} 
                  className={`p-3 rounded-lg border cursor-pointer ${selectedStationId === station.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                  onClick={() => setSelectedStation(station.id)}
                >
                  <div className="font-medium text-sm">{station.name}</div>
                  <div className="text-xs text-gray-500">{station.code}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
      centerContent={
        <MapView
          features={features}
          selectedStationId={selectedStationId}
          onSelectStation={setSelectedStation}
          activeLayers={activeLayers}
        />
      }
      bottomContent={
        selectedStationId ? (
          <HistorySection stationId={selectedStationId} />
        ) : null
      }
      rightPanel={
        <div className="p-4 h-full bg-gray-50 overflow-y-auto space-y-4">
          <RightPanel stationId={selectedStationId} />
        </div>
      }
    />
  );
}

export function MapPage() {
  return (
    <FilterProvider>
      <MapPageContent />
    </FilterProvider>
  );
}
