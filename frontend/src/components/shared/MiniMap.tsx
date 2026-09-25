import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';

interface MiniMapProps {
  markers: {
    id: number | string;
    lat: number;
    lng: number;
    color: string;
    label?: string;
  }[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export function MiniMap({ markers, center = [10.0, 105.5], zoom = 7, height = '400px' }: MiniMapProps) {
  const createIcon = (color: string) => {
    return L.divIcon({
      className: 'minimap-marker',
      html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

  return (
    <div style={{ height }} className="w-full rounded-xl overflow-hidden border border-gray-200">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        zoomControl={false}
        className="w-full h-full"
        style={{ background: '#f1f5f9' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ZoomControl position="topright" />
        
        {markers.map((m) => (
          <Marker 
            key={m.id} 
            position={[m.lat, m.lng]} 
            icon={createIcon(m.color)}
          >
            {m.label && (
              <Popup className="text-xs font-semibold px-2 py-1">{m.label}</Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
