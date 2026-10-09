/** Vị trí theo độ (WGS84) */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Khoảng cách theo đường chim bay (công thức haversine), km */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** `count` trạm gần `from` nhất, kèm khoảng cách, gần trước */
export function nearestStations<T extends { latitude: number; longitude: number }>(
  stations: T[], from: LatLng, count = 3,
): { station: T; km: number }[] {
  return stations
    .map((station) => ({ station, km: distanceKm(from, { lat: station.latitude, lng: station.longitude }) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}

/** "800 m", "4,2 km", "35 km" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000 / 50) * 50} m`;
  return `${km.toLocaleString('vi-VN', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}
