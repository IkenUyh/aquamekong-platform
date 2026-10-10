import { useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet';
import { StationMarker } from './StationMarker';
import { MapLegend } from './MapLegend';
import { MapFlyToStation } from '../hooks/useMapFlyTo';
import type { GeoJsonFeature } from '../types';
import type { ColorMetric } from '../utils/metricScales';
import type { Feature, GeoJsonObject } from 'geojson';
import type { Layer } from 'leaflet';
import provincesData from '../data/mekong-provinces.json';
import riversData from '../data/mekong-rivers.json';

const provincesGeoJson = provincesData as GeoJsonObject;
const riversGeoJson = riversData as GeoJsonObject;

interface MapViewProps {
  features: GeoJsonFeature[];
  selectedStationId: number | null;
  onSelectStation: (id: number | null) => void;
  activeLayers: Record<string, boolean>;
  colorMetric: ColorMetric;
}

// Mekong Delta center coordinates
const MEKONG_CENTER: [number, number] = [10.0, 105.8];
const DEFAULT_ZOOM = 9;

// OpenStreetMap map tiles
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Từ mức zoom này tên trạm hiện thẳng trên marker; nhỏ hơn thì chỉ hiện khi rê chuột */
const SHOW_NAMES_ZOOM = 11;

function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

/** Ranh giới tỉnh: src/data/mekong-provinces.json, sông kênh: mekong-rivers.json (tạo bằng scripts/build_map_layers.py) */
function bindName(feature: Feature, layer: Layer) {
  const name = feature.properties?.name;
  if (name) layer.bindTooltip(String(name), { sticky: true, direction: 'top', className: 'text-xs' });
}

export function MapView({ features, selectedStationId, onSelectStation, activeLayers, colorMetric }: MapViewProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const selectedFeature = features.find(f => f.properties.id === selectedStationId);
  const flyToCenter: [number, number] | null = selectedFeature 
    ? [selectedFeature.geometry.coordinates[1], selectedFeature.geometry.coordinates[0]] // Leaflet takes [lat, lng]
    : null;
  const allStations = features.map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number]);

  return (
    <MapContainer
      center={MEKONG_CENTER}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full"
      zoomControl={true}
      id="map-container"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

      {activeLayers.provinces && (
        <GeoJSON
          data={provincesGeoJson}
          style={{ color: '#0F3D5E', weight: 2, opacity: 0.55, fillColor: '#0F3D5E', fillOpacity: 0.03 }}
          onEachFeature={bindName}
        />
      )}

      {activeLayers.rivers && (
        <GeoJSON
          data={riversGeoJson}
          // Sông nét đậm hơn kênh; tên hiện khi rê chuột
          style={(f) => (f?.properties?.kind === 'canal'
            ? { color: '#38bdf8', weight: 1, opacity: 0.7 }
            : { color: '#0ea5e9', weight: 2, opacity: 0.75 })}
          onEachFeature={bindName}
        />
      )}

      {features.map((feature) => (
        <StationMarker
          key={feature.properties.id}
          feature={feature}
          isSelected={feature.properties.id === selectedStationId}
          onClick={() => onSelectStation(feature.properties.id)}
          metric={colorMetric}
          showName={zoom >= SHOW_NAMES_ZOOM}
        />
      ))}

      <MapFlyToStation center={flyToCenter} overview={allStations} />
      {selectedStationId != null && (
        <button type="button" onClick={() => onSelectStation(null)}
          className="absolute top-3 right-3 z-[1000] btn-secondary px-3 py-1.5 text-sm shadow-md">
          Xem toàn vùng
        </button>
      )}
      <ZoomWatcher onZoom={setZoom} />
      <MapLegend metric={colorMetric} />
    </MapContainer>
  );
}
