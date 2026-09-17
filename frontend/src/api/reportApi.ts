import apiClient, { withFallback } from './client';
import { MOCK_TREND_DATA, MOCK_TOP_STATIONS } from '../data/mockData';

export const reportApi = {
  getTrendData: () =>
    withFallback(
      apiClient.get('/reports/trend').then((r) => r.data),
      MOCK_TREND_DATA
    ),

  getTopStations: () =>
    withFallback(
      apiClient.get('/reports/top-stations').then((r) => r.data),
      MOCK_TOP_STATIONS
    ),
};
