import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { StationPanel } from './components/StationPanel';
import { useStations, useStationsList } from './hooks/useStations';
import { useTelemetrySSE } from './hooks/useTelemetrySSE';
import type { GeoJsonFeature, Station } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  // Fetch data
  const { data: geoJson, isLoading: isLoadingGeo } = useStations();
  const { data: stationsList, isLoading: isLoadingList } = useStationsList();

  // SSE telemetry
  const { isConnected } = useTelemetrySSE({
    onTelemetry: useCallback((_data) => {
      // Invalidate queries to refresh data when new telemetry arrives
      queryClient.invalidateQueries({ queryKey: ['stations'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    }, []),
  });

  const features: GeoJsonFeature[] = geoJson?.features ?? [];
  const stations: Station[] = stationsList ?? [];

  const selectedStation = stations.find((s) => s.id === selectedStationId) ?? null;

  return (
    <Layout
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      isConnected={isConnected}
      sidebar={
        <Sidebar
          stations={stations}
          selectedStationId={selectedStationId}
          onSelectStation={setSelectedStationId}
          isLoading={isLoadingList}
        />
      }
    >
      {/* Map */}
      <MapView
        features={features}
        selectedStationId={selectedStationId}
        onSelectStation={setSelectedStationId}
      />

      {/* Station detail panel */}
      {selectedStation && (
        <StationPanel
          station={selectedStation}
          onClose={() => setSelectedStationId(null)}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
