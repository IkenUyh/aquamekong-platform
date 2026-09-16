import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { GeoJsonFeature } from '../../types';

interface SalinityHeatmapProps {
  features: GeoJsonFeature[];
  enabled: boolean;
}

export function SalinityHeatmap({ features, enabled }: SalinityHeatmapProps) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !features || features.length === 0) return;

    // Convert GeoJSON features -> heatmap points [lat, lng, intensity]
    const points: [number, number, number][] = features
      .filter(f => (f.properties as any).latestSalinity !== undefined && (f.properties as any).latestSalinity !== null)
      .map(f => [
        f.geometry.coordinates[1], // lat
        f.geometry.coordinates[0], // lng
        normalizeIntensity((f.properties as any).latestSalinity),
      ]);

    if (points.length === 0) return;

    // @ts-ignore - leaflet.heat extends L globally
    const heatLayer = L.heatLayer(points, {
      radius: 60,        // Bán kính pixel
      blur: 40,          // Blur
      maxZoom: 12,
      max: 1.0,
      gradient: {
        0.0: '#06b6d4',  // Cyan — thấp
        0.2: '#22c55e',  // Green — an toàn
        0.4: '#84cc16',  // Lime
        0.6: '#eab308',  // Yellow — cảnh báo
        0.8: '#ef4444',  // Red — nguy hiểm
        1.0: '#7f1d1d',  // Dark red — rất cao
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, features, enabled]);

  return null;
}

function normalizeIntensity(salinity: number, max: number = 20): number {
  return Math.min(salinity / max, 1.0);
}
