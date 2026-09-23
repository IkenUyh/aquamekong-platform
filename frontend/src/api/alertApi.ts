import apiClient, { withFallback } from './client';
import { AlertDto } from '../types/alert';
import { MOCK_ALERTS } from '../data/mockData';
import type { AxiosResponse } from 'axios';

export const alertApi = {
  getRecent: () =>
    withFallback(
      apiClient.get<AlertDto[]>('/alerts').then((r: AxiosResponse<AlertDto[]>) => {
        if (Array.isArray(r.data) && r.data.length > 0) return r.data;
        return MOCK_ALERTS;
      }),
      MOCK_ALERTS
    ),

  getUnresolved: () =>
    withFallback(
      apiClient.get<AlertDto[]>('/alerts/unresolved').then((r: AxiosResponse<AlertDto[]>) => {
        if (Array.isArray(r.data) && r.data.length > 0) return r.data;
        return MOCK_ALERTS.filter(a => a.isActive);
      }),
      MOCK_ALERTS.filter(a => a.isActive)
    ),

  getCount: () =>
    withFallback(
      apiClient.get<{ count: number }>('/alerts/count').then((r: AxiosResponse<{ count: number }>) => r.data),
      { count: MOCK_ALERTS.filter(a => a.isActive).length }
    ),
};
