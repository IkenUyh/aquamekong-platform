import axios from 'axios';
import { store } from '../store';
import { setOfflineMode } from '../store/networkSlice';
import type { GeoJsonFeatureCollection, Station, WaterMetric, SalinityForecast } from '../types';
import { MOCK_STATIONS_LIST, generateMockForecasts } from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Helper function for fallback mechanism
export async function withFallback<T>(promise: Promise<T>, fallbackData: T): Promise<T> {
  try {
    const result = await promise;
    
    // If successful and we were in offline mode, switch back to online
    if (store.getState().network.isOfflineMode) {
      store.dispatch(setOfflineMode(false));
    }
    
    return result;
  } catch (error) {
    console.warn('[Offline Fallback Activated] Failed to fetch data, using mock data.', error);
    
    // Dispatch offline mode if not already set
    if (!store.getState().network.isOfflineMode) {
      store.dispatch(setOfflineMode(true));
    }
    
    return fallbackData;
  }
}

export default apiClient;

// ===== API Functions =====

export const stationApi = {
  getAll: () => {
    const fallback: any = {
      type: "FeatureCollection",
      features: MOCK_STATIONS_LIST.map(s => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
        properties: s
      }))
    };
    // Since backend returns List<StationDto>, we need to map it if backend endpoint is /stations/geojson or just map frontend
    // Assuming backend /stations returns list, we map it to FeatureCollection here
    return withFallback(
      apiClient.get<Station[]>('/stations').then((r) => ({
        type: "FeatureCollection",
        features: r.data.map(s => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
          properties: s
        }))
      }) as any), 
      fallback
    );
  },

  getAllList: () => 
    withFallback(
      apiClient.get<Station[]>('/stations').then((r) => r.data),
      MOCK_STATIONS_LIST
    ),

  getById: (id: number) =>
    withFallback(
      apiClient.get<Station>(`/stations/${id}`).then((r) => r.data),
      MOCK_STATIONS_LIST.find(s => s.id === id) || MOCK_STATIONS_LIST[0]
    ),

  create: (data: Partial<Station>) =>
    apiClient.post<Station>('/stations', data).then((r) => r.data),

  update: (id: number, data: Partial<Station>) =>
    apiClient.put<Station>(`/stations/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/stations/${id}`),

  getNearby: (lng: number, lat: number, radius: number = 50) =>
    withFallback(
      apiClient.get<GeoJsonFeatureCollection>('/stations/nearby', {
        params: { lng, lat, radius },
      }).then((r) => r.data),
      { type: "FeatureCollection", features: [] } as any
    ),
};

export const metricApi = {
  getLatest: () =>
    withFallback(
      apiClient.get<WaterMetric[]>('/metrics/latest').then((r) => r.data),
      [] // Add proper mock data if needed
    ),

  getByStation: (stationId: number) =>
    withFallback(
      apiClient.get<WaterMetric[]>(`/metrics/station/${stationId}`).then((r) => r.data),
      [
        { id: 1, stationId, salinity: 4.5, waterLevel: 1.2, recordedAt: new Date().toISOString() } as WaterMetric
      ]
    ),

  getByStationWithDateRange: (stationId: number, from: string, to: string) =>
    withFallback(
      apiClient.get<WaterMetric[]>(`/metrics/station/${stationId}`, {
        params: { from, to },
      }).then((r) => r.data),
      []
    ),
};

export const forecastApi = {
  predict: (stationId: number, daysAhead: number = 7) =>
    apiClient.post<SalinityForecast[]>('/forecasts/predict', { stationId, daysAhead }).then((r) => r.data),

  getByStation: (stationId: number) => 
    withFallback(
      apiClient.get<SalinityForecast[]>(`/forecasts/station/${stationId}`).then((r) => r.data),
      generateMockForecasts(stationId)
    )
};

