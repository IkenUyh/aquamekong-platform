import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { StationMarker } from './StationMarker';
import { MapLegend } from './MapLegend';
import { MapFlyToStation } from '../hooks/useMapFlyTo';
import type { GeoJsonFeature } from '../types';
import { MetricHeatmap } from './map/MetricHeatmap';
import type { HeatMetric } from '../utils/heatScales';
import type { Feature, GeoJsonObject } from 'geojson';
import type { Layer } from 'leaflet';
import provincesData from '../data/mekong-provinces.json';
import riversData from '../data/mekong-rivers.json';

const provincesGeoJson = provincesData as GeoJsonObject;
const riversGeoJson = riversData as GeoJsonObject;

interface MapViewProps {
  features: GeoJsonFeature[];
  selectedStationId: number | null;
  onSelectStation: (id: number) => void;
  activeLayers: Record<string, boolean>;
}

// Mekong Delta center coordinates
const MEKONG_CENTER: [number, number] = [10.0, 105.8];
const DEFAULT_ZOOM = 9;

// OpenStreetMap map tiles
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const HEAT_METRICS: HeatMetric[] = ['salinity', 'waterLevel', 'flowRate'];

/** Ranh giới tỉnh: src/data/mekong-provinces.json, sông kênh: mekong-rivers.json (tạo bằng scripts/build_map_layers.py) */
function bindName(feature: Feature, layer: Layer) {
  const name = feature.properties?.name;
  if (name) layer.bindTooltip(String(name), { sticky: true, direction: 'top', className: 'text-xs' });
}

export function MapView({ features, selectedStationId, onSelectStation, activeLayers }: MapViewProps) {
  const heatMetric = HEAT_METRICS.find((m) => activeLayers[m]) ?? null;
  const selectedFeature = features.find(f => f.properties.id === selectedStationId);
  const flyToCenter: [number, number] | null = selectedFeature 
    ? [selectedFeature.geometry.coordinates[1], selectedFeature.geometry.coordinates[0]] // Leaflet takes [lat, lng]
    : null;

  return (
    <MapContainer
      center={MEKONG_CENTER}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full"
      zoomControl={true}
      id="map-container"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

      {heatMetric && <MetricHeatmap features={features} metric={heatMetric} />}

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
        />
      ))}

      <MapFlyToStation center={flyToCenter} />
      <MapLegend metric={heatMetric} />
    </MapContainer>
  );
}
