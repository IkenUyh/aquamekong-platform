import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export function MapFlyToStation({ center }: { center: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, 12, { duration: 1 });
    }
  }, [center, map]);

  return null;
}
