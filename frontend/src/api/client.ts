import axios from 'axios';
import { store } from '../store';
import { setOfflineMode } from '../store/networkSlice';
import type {
  GeoJsonFeatureCollection,
  Station,
  River,
  Device,
  Sensor,
  Measurement,
  TelemetryIngest,
  ForecastRun,
  SalinityForecast,
  AlertRule,
  Alert,
  User,
} from '../types';
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

// ===== API Services =====

export const riverApi = {
  getAll: () => apiClient.get<River[]>('/rivers').then((r) => r.data),
  getById: (id: number) => apiClient.get<River>(`/rivers/${id}`).then((r) => r.data),
  create: (data: Partial<River>) => apiClient.post<River>('/rivers', data).then((r) => r.data),
  update: (id: number, data: Partial<River>) => apiClient.put<River>(`/rivers/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/rivers/${id}`),
};

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

export const deviceApi = {
  getAll: () => apiClient.get<Device[]>('/devices').then((r) => r.data),
  getById: (id: number) => apiClient.get<Device>(`/devices/${id}`).then((r) => r.data),
  getByStation: (stationId: number) => apiClient.get<Device[]>(`/devices/station/${stationId}`).then((r) => r.data),
  create: (data: Partial<Device>) => apiClient.post<Device>('/devices', data).then((r) => r.data),
  update: (id: number, data: Partial<Device>) => apiClient.put<Device>(`/devices/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/devices/${id}`),
};

export const sensorApi = {
  getAll: () => apiClient.get<Sensor[]>('/sensors').then((r) => r.data),
  getById: (id: number) => apiClient.get<Sensor>(`/sensors/${id}`).then((r) => r.data),
  getByDevice: (deviceId: number) => apiClient.get<Sensor[]>(`/sensors/device/${deviceId}`).then((r) => r.data),
  create: (data: Partial<Sensor>) => apiClient.post<Sensor>('/sensors', data).then((r) => r.data),
  update: (id: number, data: Partial<Sensor>) => apiClient.put<Sensor>(`/sensors/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/sensors/${id}`),
};

export const measurementApi = {
  getLatestPerStation: () => apiClient.get<Measurement[]>('/measurements/latest').then((r) => r.data),
  getByStation: (stationId: number) => apiClient.get<Measurement[]>(`/measurements/station/${stationId}`).then((r) => r.data),
  getByStationAndRange: (stationId: number, from: string, to: string) =>
    apiClient.get<Measurement[]>(`/measurements/station/${stationId}/range`, { params: { from, to } }).then((r) => r.data),
  ingest: (data: TelemetryIngest) => apiClient.post<Measurement>('/measurements/ingest', data).then((r) => r.data),
};

export const metricApi = {
  getLatest: () =>
    withFallback(
      apiClient.get<Measurement[]>('/measurements/latest').then((r) => r.data),
      []
    ),

  getByStation: (stationId: number) =>
    withFallback(
      apiClient.get<Measurement[]>(`/measurements/station/${stationId}`).then((r) => r.data),
      []
    ),

  getByStationWithDateRange: (stationId: number, from: string, to: string) =>
    withFallback(
      apiClient.get<Measurement[]>(`/measurements/station/${stationId}/range`, {
        params: { from, to },
      }).then((r) => r.data),
      []
    ),
};

export const forecastApi = {
  getRuns: () => apiClient.get<ForecastRun[]>('/forecasts/runs').then((r) => r.data),

  predict: (stationId: number, daysAhead: number = 7) =>
    apiClient.post<SalinityForecast[]>('/forecasts/predict', { stationId, daysAhead }).then((r) => r.data),

  getByStation: (stationId: number) => 
    withFallback(
      apiClient.get<SalinityForecast[]>(`/forecasts/station/${stationId}`).then((r) => r.data),
      generateMockForecasts(stationId)
    ),

  getByRunId: (runId: number) => apiClient.get<SalinityForecast[]>(`/forecasts/run/${runId}`).then((r) => r.data),
};

export const alertApi = {
  getAll: () => apiClient.get<Alert[]>('/alerts').then((r) => r.data),
  getByStation: (stationId: number) => apiClient.get<Alert[]>(`/alerts/station/${stationId}`).then((r) => r.data),
  getRules: () => apiClient.get<AlertRule[]>('/alerts/rules').then((r) => r.data),
  saveRule: (rule: Partial<AlertRule>) => apiClient.post<AlertRule>('/alerts/rules', rule).then((r) => r.data),
  deleteRule: (id: number) => apiClient.delete(`/alerts/rules/${id}`),
};

export const userApi = {
  getAll: () => apiClient.get<User[]>('/users').then((r) => r.data),
  getById: (id: number) => apiClient.get<User>(`/users/${id}`).then((r) => r.data),
};
