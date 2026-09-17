import apiClient, { withFallback } from './client';
import { AlertDto } from '../types/alert';
import { MOCK_ALERTS } from '../data/mockData';
import type { AxiosResponse } from 'axios';

export const alertApi = {
  getRecent: () =>
    withFallback(
      apiClient.get<AlertDto[]>('/alerts').then((r: AxiosResponse<AlertDto[]>) => r.data),
      MOCK_ALERTS
    ),

  getUnresolved: () =>
    withFallback(
      apiClient.get<AlertDto[]>('/alerts/unresolved').then((r: AxiosResponse<AlertDto[]>) => r.data),
      MOCK_ALERTS.filter(a => !a.isResolved)
    ),

  getCount: () =>
    withFallback(
      apiClient.get<{ count: number }>('/alerts/count').then((r: AxiosResponse<{ count: number }>) => r.data),
      { count: MOCK_ALERTS.filter(a => !a.isResolved).length }
    ),

  getCountBySeverity: () =>
    withFallback(
      apiClient.get<Record<string, number>>('/alerts/count-by-severity').then((r) => r.data),
      {
        CRITICAL: MOCK_ALERTS.filter(a => !a.isResolved && a.severity === 'CRITICAL').length,
        WARNING: MOCK_ALERTS.filter(a => !a.isResolved && a.severity === 'WARNING').length,
        INFO: MOCK_ALERTS.filter(a => !a.isResolved && a.severity === 'INFO').length,
      }
    ),
};

