import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
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
  /** Bay tới marker này và mở popup của nó */
  focusId?: number | string | null;
}

type MarkerPoint = MiniMapProps['markers'][number];

// Mỗi màu một icon dùng chung: trang phát lại đổi màu marker nhiều lần mỗi giây
const iconCache = new Map<string, L.DivIcon>();

function createIcon(color: string): L.DivIcon {
  let icon = iconCache.get(color);
  if (!icon) {
    icon = L.divIcon({
      className: 'minimap-marker',
      html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    iconCache.set(color, icon);
  }
  return icon;
}

/** Lần đầu có marker: canh khung vừa các trạm thay vì giữ center/zoom mặc định */
function FitToMarkersOnce({ markers }: { markers: MarkerPoint[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || markers.length === 0) return;
    map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [24, 24] });
    done.current = true;
  }, [map, markers]);
  return null;
}

/** Khung chứa đổi cỡ (layout, lazy load) thì Leaflet đo lại, nếu không nền bản đồ chỉ vẽ một phần */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function FocusMarker({ marker, refs }: { marker: MarkerPoint | undefined; refs: Map<MarkerPoint['id'], L.Marker> }) {
  const map = useMap();
  useEffect(() => {
    if (!marker) return;
    map.flyTo([marker.lat, marker.lng], Math.max(map.getZoom(), 10), { duration: 0.6 });
    refs.get(marker.id)?.openPopup();
    // Chỉ chạy khi đổi trạm được chọn, không chạy lại khi màu marker đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, marker?.id]);
  return null;
}

export function MiniMap({ markers, center = [10.0, 105.5], zoom = 7, height = '400px', focusId = null }: MiniMapProps) {
  const markerRefs = useRef(new Map<MarkerPoint['id'], L.Marker>()).current;
  const focused = focusId == null ? undefined : markers.find((m) => m.id === focusId);

  return (
    <div style={{ height }} className="w-full rounded-lg overflow-hidden border border-gray-200">
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
            ref={(ref) => { if (ref) markerRefs.set(m.id, ref); else markerRefs.delete(m.id); }}
          >
            {m.label && (
              <Popup className="text-xs font-semibold px-2 py-1">{m.label}</Popup>
            )}
          </Marker>
        ))}
        <InvalidateOnResize />
        <FitToMarkersOnce markers={markers} />
        <FocusMarker marker={focused} refs={markerRefs} />
      </MapContainer>
    </div>
  );
}
