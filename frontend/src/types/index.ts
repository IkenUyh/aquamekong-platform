// ===================================
// AquaMekong — TypeScript Type Definitions
// ===================================

export interface Station {
  id: number;
  code: string;
  name: string;
  longitude: number;
  latitude: number;
  riverName: string;
  province: string;
  status: string;
  latestSalinity: number | null;
  latestWaterLevel: number | null;
  latestFlowRate: number | null;
  salinityLevel: SalinityLevel;
}

export type SalinityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export interface WaterMetric {
  id: number;
  stationId: number;
  stationCode: string;
  stationName: string;
  salinity: number;
  waterLevel: number;
  flowRate: number;
  recordedAt: string;
  salinityLevel: SalinityLevel;
}

export interface SalinityForecast {
  id: number;
  stationId: number;
  forecastDate: string;
  predictedSalinity: number;
  confidenceLevel: number;
  lowerBound: number;
  upperBound: number;
  modelVersion: string;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: Station;
}

// SSE Event types
export interface TelemetryEvent {
  stationId: number;
  stationCode: string;
  stationName: string;
  salinity: number;
  waterLevel: number;
  flowRate: number;
  recordedAt: string;
  salinityLevel: SalinityLevel;
}
