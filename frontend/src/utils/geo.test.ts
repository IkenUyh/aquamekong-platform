import { describe, expect, it } from 'vitest';
import { distanceKm, formatDistance, nearestStations } from './geo';

const CAN_THO = { lat: 10.0452, lng: 105.7469 };
const MY_THO = { lat: 10.3600, lng: 106.3600 };

describe('distanceKm', () => {
  it('measures great-circle distance between Delta towns', () => {
    // Cần Thơ - Mỹ Tho khoảng 75 km đường chim bay
    expect(distanceKm(CAN_THO, MY_THO)).toBeGreaterThan(70);
    expect(distanceKm(CAN_THO, MY_THO)).toBeLessThan(80);
    expect(distanceKm(CAN_THO, CAN_THO)).toBe(0);
  });
});

describe('nearestStations', () => {
  it('returns the closest stations first, with their distance', () => {
    const stations = [
      { id: 1, latitude: MY_THO.lat, longitude: MY_THO.lng },
      { id: 2, latitude: 10.05, longitude: 105.75 },
      { id: 3, latitude: 9.6, longitude: 105.97 },

// TODO: complete edge-case assertions and verification
