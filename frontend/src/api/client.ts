import axios, { isAxiosError } from 'axios';
import { clearToken, getToken, UNAUTHORIZED_EVENT } from '../auth/tokenStorage';
import { store } from '../store';
import { setOfflineMode } from '../store/networkSlice';
import type {
  GeoJsonFeatureCollection,
  Station,
  River,
  Device,
  Sensor,
  Measurement,
  MetricType,
  TelemetryIngest,
  ForecastRun,
  SalinityForecast,
  User,
  UserStatus,
} from '../types';
import { MOCK_STATIONS_LIST, generateMockForecasts } from '../data/mockData';

// Mặc định gọi cùng origin: nginx (production) và Vite dev server đều proxy /api -> backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Gắn access token vào mọi request
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 (token hết hạn / không hợp lệ) -> xoá token, AuthContext chuyển về trang đăng nhập
apiClient.interceptors.response.use(undefined, (error) => {
  if (isAxiosError(error) && error.response?.status === 401 && !error.config?.url?.startsWith('/auth/login')) {
    clearToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return Promise.reject(error);
});

const isAuthError = (error: unknown) =>
  isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);

// Mock data chỉ dùng khi dev (hoặc bật VITE_ENABLE_MOCK_FALLBACK=true), để production không che lỗi API thật
export const MOCK_FALLBACK_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_FALLBACK === 'true';

// Thay dữ liệu rỗng bằng mock — chỉ khi mock fallback được bật
export function orMock<T>(data: T, mock: T): T {
  return MOCK_FALLBACK_ENABLED ? mock : data;
}

// Helper function for fallback mechanism
export async function withFallback<T>(promise: Promise<T>, fallbackData: T): Promise<T> {
  if (!MOCK_FALLBACK_ENABLED) return promise;

  try {
    const result = await promise;
    
    // If successful and we were in offline mode, switch back to online
    if (store.getState().network.isOfflineMode) {
      store.dispatch(setOfflineMode(false));
    }
    
    return result;
  } catch (error) {
    // Lỗi đăng nhập / phân quyền không bao giờ được che bằng mock data
    if (isAuthError(error)) throw error;

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

const toFeatureCollection = (stations: Station[]): GeoJsonFeatureCollection => ({
  type: 'FeatureCollection',
  features: stations.map((s) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
    properties: s,
  })),
});

const EMPTY_FEATURE_COLLECTION: GeoJsonFeatureCollection = { type: 'FeatureCollection', features: [] };

export const stationApi = {
  /** GET /stations trả GeoJSON; chấp nhận cả dạng mảng (backend cũ) */
  getAll: (): Promise<GeoJsonFeatureCollection> => {
    const fallback = toFeatureCollection(MOCK_STATIONS_LIST);
    return withFallback(
      apiClient.get<GeoJsonFeatureCollection | Station[]>('/stations').then((r) => {
        if (Array.isArray(r.data)) return toFeatureCollection(r.data);
        if (r.data?.type === 'FeatureCollection') return r.data;
        return orMock(EMPTY_FEATURE_COLLECTION, fallback);
      }),
      fallback
    );
  },

  /** GET /stations/list trả mảng Station; chấp nhận cả dạng GeoJSON */
  getAllList: (): Promise<Station[]> =>
    withFallback(
      apiClient.get<Station[] | GeoJsonFeatureCollection>('/stations/list').then((r) => {
        if (Array.isArray(r.data) && r.data.length > 0) return r.data;
        if (!Array.isArray(r.data) && Array.isArray(r.data?.features)) {
          return r.data.features.map((f) => f.properties);
        }
        return orMock<Station[]>([], MOCK_STATIONS_LIST);
      }),
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
      EMPTY_FEATURE_COLLECTION
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

  /** metricType (vd. 'salinity') để chỉ lấy 1 chỉ số — API trả về mọi chỉ số nếu bỏ trống */
  getByStation: (stationId: number, metricType?: MetricType, limit?: number) =>
    withFallback(
      apiClient.get<Measurement[]>(`/measurements/station/${stationId}`, { params: { metricType, limit } }).then((r) => r.data),
      []
    ),

  getByStationWithDateRange: (stationId: number, from: string, to: string, metricType?: MetricType) =>
    withFallback(
      apiClient.get<Measurement[]>(`/measurements/station/${stationId}/range`, {
        params: { from, to, metricType },
      }).then((r) => r.data),
      []
    ),
};

/** Ngày theo giờ máy người dùng, dạng yyyy-MM-dd (cùng định dạng LocalDate của backend) */
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayIso = () => isoDate(new Date());
const tomorrowIso = () => isoDate(new Date(Date.now() + 86_400_000));

export const forecastApi = {
  getRuns: () => apiClient.get<ForecastRun[]>('/forecasts/runs').then((r) => r.data),

  predict: (stationId: number, daysAhead: number = 7) =>
    // ML (ARIMA + CNN) có thể chạy lâu hơn timeout mặc định 10s
    apiClient.post<SalinityForecast[]>('/forecasts/predict', { stationId, daysAhead }, { timeout: 60000 }).then((r) => r.data),

  getByStation: (stationId: number) => 
    withFallback(
      apiClient.get<SalinityForecast[]>(`/forecasts/station/${stationId}`).then((r) => r.data),
      generateMockForecasts(stationId)
    ),

  /**
   * `daysAhead` ngày dự báo bắt đầu từ ngày mai. Lượt chạy mới nhất đã cũ (ngày đầu đã qua)
   * hoặc ngắn hơn số ngày cần -> chạy ML lại (POST /forecasts/predict).
   */
  getOrPredict: (stationId: number, daysAhead: number = 7) =>
    withFallback(
      apiClient.get<SalinityForecast[]>(`/forecasts/station/${stationId}`).then(async (r) => {
        const fromTomorrow = r.data.filter((f) => f.forecastDate > todayIso());
        const usable = fromTomorrow.length >= daysAhead && r.data[0]?.forecastDate === tomorrowIso();
        const forecasts = usable ? fromTomorrow : await forecastApi.predict(stationId, daysAhead);
        return forecasts.slice(0, daysAhead);
      }),
      generateMockForecasts(stationId)
    ),

  getByRunId: (runId: number) => apiClient.get<SalinityForecast[]>(`/forecasts/run/${runId}`).then((r) => r.data),
};


export interface CreateUserRequest {
  username: string;
  email: string;
  fullName?: string;
  password: string;
  roles: string[];
}

export const userApi = {
  getAll: () => apiClient.get<User[]>('/users').then((r) => r.data),
  getById: (id: number) => apiClient.get<User>(`/users/${id}`).then((r) => r.data),
  create: (data: CreateUserRequest) => apiClient.post<User>('/users', data).then((r) => r.data),
  updateStatus: (id: number, status: UserStatus) =>
    apiClient.put<User>(`/users/${id}/status`, null, { params: { status } }).then((r) => r.data),
  addRole: (id: number, roleName: string) => apiClient.post(`/users/${id}/roles`, null, { params: { roleName } }),
  removeRole: (id: number, roleName: string) => apiClient.delete(`/users/${id}/roles`, { params: { roleName } }),
};

/** Thông báo lỗi tiếng Việt từ response backend ({ message }), dùng cho form */
export function apiErrorMessage(error: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại.'): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
    if (error.response?.status === 403) return 'Bạn không có quyền thực hiện thao tác này';
  }
  return fallback;
}
