import { withFallback } from './client';
import { MOCK_TREND_DATA, MOCK_TOP_STATIONS } from '../data/mockData';

// Since there is no report endpoint in the backend currently, 
// we only use mock data. This will be updated once the backend supports it.

export const reportApi = {
  getTrendData: () =>
    withFallback(
      Promise.reject(new Error("Report API not yet implemented on backend")),
      MOCK_TREND_DATA
    ),

  getTopStations: () =>
    withFallback(
      Promise.reject(new Error("Report API not yet implemented on backend")),
      MOCK_TOP_STATIONS
    ),
};
