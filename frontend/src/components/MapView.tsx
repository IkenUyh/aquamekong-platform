import { MapContainer, TileLayer } from 'react-leaflet';
import { StationMarker } from './StationMarker';
import type { GeoJsonFeature } from '../types';

interface MapViewProps {
  features: GeoJsonFeature[];
  selectedStationId: number | null;
  onSelectStation: (id: number) => void;
}

// Mekong Delta center coordinates
const MEKONG_CENTER: [number, number] = [10.0, 105.8];
const DEFAULT_ZOOM = 9;

// Dark-themed map tiles
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

export function MapView({ features, selectedStationId, onSelectStation }: MapViewProps) {
  return (
    <MapContainer
      center={MEKONG_CENTER}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full"
      zoomControl={true}
      id="map-container"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      {features.map((feature) => (
        <StationMarker
          key={feature.properties.id}
          feature={feature}
          isSelected={feature.properties.id === selectedStationId}
          onClick={() => onSelectStation(feature.properties.id)}
        />
      ))}
    </MapContainer>
  );
}
