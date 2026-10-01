import apiClient, { orMock, withFallback } from './client';
import type { Alert, AlertDto, AlertRule, AlertSeverity } from '../types';
import { MOCK_ALERTS } from '../data/mockData';
import { metricLabel } from '../utils/salinity';

const LEVEL_BY_SEVERITY: Record<AlertSeverity, NonNullable<AlertDto['alertLevel']>> = {
  CRITICAL: 'CRITICAL',
  HIGH: 'CRITICAL',
  MEDIUM: 'WARNING',
  LOW: 'INFO',
};


/** Backend Alert -> dạng UI đang dùng (alertLevel, measuredValue, message...). */
export function toAlertDto(a: Alert): AlertDto {
  const metric = metricLabel(a.metricType);
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
    resolvedAt: a.resolvedAt,
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

  /** Cảnh báo chưa xử lý xong: ACTIVE + ACKNOWLEDGED, mới nhất trước */
  getUnresolved: () =>
    withFallback(
      Promise.all([
        apiClient.get<Alert[]>('/alerts/status/ACTIVE'),
        apiClient.get<Alert[]>('/alerts/status/ACKNOWLEDGED'),
      ]).then(([active, acknowledged]) => {
        const all = [...active.data, ...acknowledged.data]
          .sort((a, b) => (b.triggeredAt ?? '').localeCompare(a.triggeredAt ?? ''))
          .map(toAlertDto);
        return all.length > 0 ? all : orMock([], activeMocks());
      }),
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
