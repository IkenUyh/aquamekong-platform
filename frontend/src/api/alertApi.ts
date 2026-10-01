import apiClient, { orMock, withFallback } from './client';
import type { Alert, AlertDto, AlertRule, AlertSeverity } from '../types';
import { MOCK_ALERTS } from '../data/mockData';

const LEVEL_BY_SEVERITY: Record<AlertSeverity, NonNullable<AlertDto['alertLevel']>> = {
  CRITICAL: 'CRITICAL',
  HIGH: 'CRITICAL',
  MEDIUM: 'WARNING',
  LOW: 'INFO',
};

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  salinity: { label: 'Độ mặn', unit: '‰' },
  water_level: { label: 'Mực nước', unit: 'm' },
  flow_rate: { label: 'Lưu lượng', unit: 'm³/s' },
};

/** Backend Alert -> dạng UI đang dùng (alertLevel, measuredValue, message...). */
export function toAlertDto(a: Alert): AlertDto {
  const metric = METRIC_LABELS[a.metricType] ?? { label: a.metricType, unit: '' };
  return {
    id: a.id,
    stationId: a.stationId,
    stationName: a.stationName,
    stationCode: a.stationCode,
    province: a.province,
    metricType: a.metricType,
    severity: a.severity,
    alertLevel: LEVEL_BY_SEVERITY[a.severity] ?? 'INFO',
    status: a.status,
    message: `${metric.label} ${a.value.toFixed(2)}${metric.unit} vượt ngưỡng ${a.threshold}${metric.unit}`,
    thresholdValue: a.threshold,
    measuredValue: a.value,
    actualValue: a.value,
    isActive: a.status === 'ACTIVE',
    isResolved: a.status === 'RESOLVED',
    createdAt: a.triggeredAt ?? a.createdAt ?? new Date().toISOString(),
  };
}

const activeMocks = () => MOCK_ALERTS.filter((a) => a.isActive);

export const alertApi = {
  getRecent: () =>
    withFallback(
      apiClient.get<Alert[]>('/alerts', { params: { limit: 200 } }).then((r) =>
        r.data.length > 0 ? r.data.map(toAlertDto) : orMock([], MOCK_ALERTS)
      ),
      MOCK_ALERTS
    ),

  getUnresolved: () =>
    withFallback(
      apiClient.get<Alert[]>('/alerts/status/ACTIVE').then((r) =>
        r.data.length > 0 ? r.data.map(toAlertDto) : orMock([], activeMocks())
      ),
      activeMocks()
    ),

  getByStation: (stationId: number) =>
    apiClient.get<Alert[]>(`/alerts/station/${stationId}`).then((r) => r.data.map(toAlertDto)),

  updateStatus: (alertId: number, status: Alert['status']) =>
    apiClient.put<Alert>(`/alerts/${alertId}/status`, null, { params: { status } }).then((r) => toAlertDto(r.data)),

  getRules: () => apiClient.get<AlertRule[]>('/alerts/rules').then((r) => r.data),
  saveRule: (rule: Partial<AlertRule>) => apiClient.post<AlertRule>('/alerts/rules', rule).then((r) => r.data),
  deleteRule: (id: number) => apiClient.delete(`/alerts/rules/${id}`),
};
