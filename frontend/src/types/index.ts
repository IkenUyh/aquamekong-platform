// ===================================
// AquaMekong — TypeScript Type Definitions (12 ERD Tables + 8 ENUMs)
// ===================================

// --- ENUMs ---
export type StationStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'FAULT';
export type SensorStatus = 'ACTIVE' | 'INACTIVE' | 'CALIBRATING' | 'FAULT';
export type QualityStatus = 'VALID' | 'SUSPECT' | 'INVALID';
export type ForecastRunStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/** Phân loại độ mặn do backend trả về (StationService.classifySalinity) */
export type SalinityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

// --- Domain: Station & River ---
export interface River {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Station {
  id: number;
  riverId?: number;
  riverName?: string;
  code: string;
  name: string;
  longitude: number;
  latitude: number;
  province?: string;
  status: StationStatus;
  latestSalinity?: number | null;
  latestWaterLevel?: number | null;
  latestFlowRate?: number | null;
  salinityLevel?: SalinityLevel;
  /** Thời điểm số đo mới nhất (mọi chỉ số) */
  lastMeasuredAt?: string | null;
  /** Các chỉ số trạm đang có số đo */
  metricTypes?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// --- Domain: Devices & Sensors ---
export interface Device {
  id: number;
  stationId: number;
  stationName?: string;
  deviceCode: string;
  name?: string;
  deviceType: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status: DeviceStatus;
  installedAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sensor {
  id: number;
  deviceId: number;
  deviceCode?: string;
  sensorCode: string;
  name?: string;
  metricType: string;
  unit: string;
  calibrationDate?: string;
  status: SensorStatus;
  createdAt?: string;
  updatedAt?: string;
}

// --- Domain: Telemetry & Measurement ---
export type MetricType = 'salinity' | 'water_level' | 'flow_rate';

export interface Measurement {
  id: number;
  sensorId: number;
  sensorCode?: string;
  stationId: number;
  stationCode?: string;
  stationName?: string;
  metricType: string;
  value: number;
  unit: string;
  recordedAt: string;
  qualityStatus: QualityStatus;
  createdAt?: string;
}

export interface TelemetryIngest {
  deviceCode?: string;
  sensorCode: string;
  stationCode?: string;
  metricType?: string;
  value: number;
  unit?: string;
  recordedAt?: string;
}

// --- Domain: Forecast ---
export interface ForecastRun {
  id: number;
  modelVersion: string;
  runAt: string;
  inputFrom?: string;
  inputTo?: string;
  status: ForecastRunStatus;
  createdAt?: string;
}

export interface SalinityForecast {
  id: number;
  runId?: number;
  modelVersion?: string;
  stationId: number;
  stationCode?: string;
  stationName?: string;
  forecastDate: string;
  predictedSalinity: number;
  lowerBound?: number;
  upperBound?: number;
  confidenceLevel?: number;
  createdAt?: string;
  /** Thời điểm chạy mô hình của lượt dự báo */
  runAt?: string;
  /** Ngày cuối có dữ liệu đầu vào (ST-GNN); dự báo tính từ ngày này, có thể trước hôm nay */
  dataUntil?: string | null;
}

interface ErrorScore {
  mae: number;
  rmse: number;
}

/** Điểm ST-GNN trên tập test (GET /forecasts/model-info, khoá giữ nguyên dạng snake_case của ML service) */
export interface StgnnModelInfo {
  model_version: string;
  installed_at: string;
  trained_until: string;
  horizons: number[];
  /** Trạm đang dùng ST-GNN (tốt hơn giữ nguyên giá trị cũ trên tập test) */
  stations: string[];
  all_stations: string[];
  evaluation: Record<string, {
    overall: { stgnn: ErrorScore; naive: ErrorScore };
    interval_coverage: number;
    exceed_recall: number;
    exceed_precision: number;
    test_days: number;
  }>;
}

// --- Domain: Alert ---
export interface AlertRule {
  id: number;
  stationId: number;
  stationCode?: string;
  stationName?: string;
  metricType: string;
  operator: string;
  threshold: number;
  severity: AlertSeverity;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Cảnh báo đúng như backend trả về (GET /api/v1/alerts) */
export interface Alert {
  id: number;
  stationId: number;
  stationCode?: string;
  stationName?: string;
  province?: string;
  ruleId?: number;
  metricType: string;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  status: AlertStatus;
  triggeredAt: string;
  resolvedAt?: string;
  createdAt?: string;
}

/** Cảnh báo dạng hiển thị cho UI (map từ Alert trong api/alertApi.ts) */
export interface AlertDto {
  id: number;
  stationId: number;
  stationName?: string;
  stationCode?: string;
  province?: string;
  status?: AlertStatus;
  resolvedAt?: string;
  metricType?: string;
  alertType?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'WARNING' | 'INFO';
  alertLevel?: 'CRITICAL' | 'WARNING' | 'SAFE' | 'INFO';
  message?: string;
  thresholdValue?: number;
  measuredValue?: number;
  actualValue?: number;
  isActive?: boolean;
  isResolved?: boolean;
  createdAt: string;
}

// --- Domain: User ---
export interface User {
  id: number;
  username: string;
  /** null = tài khoản tạo bằng Zalo (Zalo không cung cấp email) */
  email: string | null;
  fullName?: string;
  status: UserStatus;
  roles?: string[];
  /** false = tài khoản tạo bằng Google, chưa đặt mật khẩu */
  hasPassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// --- GeoJSON Support ---
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
/** Event SSE "telemetry"/"init" — chính là MeasurementDto của backend */
export type TelemetryEvent = Measurement;
