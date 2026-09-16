import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { StationMarker } from './StationMarker';
import { MapLegend } from './MapLegend';
import { MapFlyToStation } from '../hooks/useMapFlyTo';
import type { GeoJsonFeature } from '../types';
import provincesGeoJson from '../data/mekong-provinces.json';
import riversGeoJson from '../data/mekong-rivers.json';

interface MapViewProps {
  features: GeoJsonFeature[];
  selectedStationId: number | null;
  onSelectStation: (id: number) => void;
  activeLayers: Record<string, boolean>;
}

// Mekong Delta center coordinates
const MEKONG_CENTER: [number, number] = [10.0, 105.8];
const DEFAULT_ZOOM = 9;

// Light-themed map tiles
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

import { SalinityHeatmap } from './map/SalinityHeatmap';

export function MapView({ features, selectedStationId, onSelectStation, activeLayers }: MapViewProps) {
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

      {activeLayers.salinity && <SalinityHeatmap features={features} enabled={true} />}

      {activeLayers.provinces && (
        <GeoJSON
          data={provincesGeoJson as any}
          style={{
            color: '#94a3b8',
            weight: 1.5,
            fillOpacity: 0.03,
            dashArray: '4 4',
          }}
        />
      )}

      {activeLayers.rivers && (
        <GeoJSON
          data={riversGeoJson as any}
          style={{
            color: '#60a5fa',
            weight: 2,
            opacity: 0.7,
          }}
        />
      )}

      {activeLayers.salinity && features.map((feature) => (
        <StationMarker
          key={feature.properties.id}
          feature={feature}
          isSelected={feature.properties.id === selectedStationId}
          onClick={() => onSelectStation(feature.properties.id)}
        />
      ))}

      <MapFlyToStation center={flyToCenter} />
      <MapLegend />
    </MapContainer>
  );
}
