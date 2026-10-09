import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../api/reportApi';
import { useAuth } from '../contexts/AuthContext';
import { formatDay, formatMeasuredAt } from '../utils/salinity';

/**
 * Cảnh báo khi sau 09:00 vẫn chưa có số đo của hôm qua: dữ liệu RYNAN đi qua GitHub Actions, Google Drive và
 * ml-service, khâu nào hỏng thì số liệu đứng yên. Quản trị/Vận hành thấy thêm chỗ cần kiểm tra.
 */
export function DataFreshnessBanner() {
  const { hasRole } = useAuth();
  const { data } = useQuery({
    queryKey: ['reports', 'data-freshness'],
    queryFn: reportApi.getDataFreshness,
    refetchInterval: 10 * 60 * 1000,
  });
  if (!data?.stale) return null;

  const latest = data.latestMeasurementAt
    ? `Số đo mới nhất là ${formatMeasuredAt(data.latestMeasurementAt)}.`
    : 'Hệ thống chưa có số đo nào.';
  return (
    <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>
        <span className="font-semibold">Dữ liệu chưa về đúng hạn.</span>{' '}
        Chưa có số đo ngày {formatDay(data.expectedDate)}. {latest} Các số liệu bên dưới có thể đã cũ.
      </p>
      {hasRole('ROLE_ADMIN', 'ROLE_OPERATOR') && (
        <p className="mt-1 text-amber-800">
          Kiểm tra lần chạy gần nhất của workflow RYNAN daily fetch trên GitHub Actions, file mới trong folder Drive,
          và log của ml-service.
        </p>
      )}
    </div>
  );
}
