import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

export default apiClient;

// ===== API Functions =====

import type { GeoJsonFeatureCollection, Station, WaterMetric, SalinityForecast } from '../types';

export const stationApi = {
  getAll: () =>
    apiClient.get<GeoJsonFeatureCollection>('/stations').then((r) => r.data),

  getAllList: () =>
    apiClient.get<Station[]>('/stations/list').then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<Station>(`/stations/${id}`).then((r) => r.data),

  create: (data: Partial<Station>) =>
    apiClient.post<Station>('/stations', data).then((r) => r.data),

  update: (id: number, data: Partial<Station>) =>
    apiClient.put<Station>(`/stations/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/stations/${id}`),

  getNearby: (lng: number, lat: number, radius: number = 50) =>
    apiClient.get<GeoJsonFeatureCollection>('/stations/nearby', {
      params: { lng, lat, radius },
    }).then((r) => r.data),
};

export const metricApi = {
  getLatest: () =>
    apiClient.get<WaterMetric[]>('/metrics/latest').then((r) => r.data),

  getByStation: (stationId: number) =>
    apiClient.get<WaterMetric[]>(`/metrics/station/${stationId}`).then((r) => r.data),
};

export const forecastApi = {
  predict: (stationId: number, daysAhead: number = 7) =>
    apiClient.post<SalinityForecast[]>('/forecasts/predict', { stationId, daysAhead }).then((r) => r.data),

  getByStation: (stationId: number) =>
    apiClient.get<SalinityForecast[]>(`/forecasts/station/${stationId}`).then((r) => r.data),
};
