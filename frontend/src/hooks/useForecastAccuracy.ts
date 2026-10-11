import { useQuery } from '@tanstack/react-query';
import { accuracyApi } from '../api/accuracyApi';

/** Backtest đổi mỗi ngày một lần (ML service lưu Redis tới hết ngày) */
export function useForecastAccuracy(days = 180) {
  return useQuery({
    queryKey: ['forecasts', 'accuracy', days],
    queryFn: () => accuracyApi.get(days),
    staleTime: 60 * 60 * 1000,
  });
}

/** Điểm cảnh báo sớm trên các mùa khô cũ; 404 (mô hình chưa học xong lần đầu) thì không thử lại */
export function useEarlyWarningEvaluation() {
  return useQuery({
    queryKey: ['forecasts', 'early-warning'],
    queryFn: accuracyApi.earlyWarning,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useForecastVerification(stationId: number, enabled: boolean, days = 30) {
  return useQuery({
    queryKey: ['forecasts', 'verification', stationId, days],
    queryFn: () => accuracyApi.verification(stationId, days),
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}
