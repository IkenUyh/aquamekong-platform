import React from 'react';
import { Link } from 'react-router-dom';
import { useUnresolvedAlerts } from '../hooks/useAlerts';
import type { AlertDto } from '../types/alert';

const BORDER: Record<string, string> = {
  CRITICAL: 'border-l-red-500',
  WARNING: 'border-l-yellow-500',
  INFO: 'border-l-gray-300',
};

/** 3 cảnh báo chưa xử lý mới nhất (viền trái theo mức độ). */
export function AlertPanel() {
  const { data: alerts } = useUnresolvedAlerts();

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Cảnh báo chưa xử lý <span className="num text-red-600">({alerts.length})</span>
        </h3>
        <Link to="/alerts" className="text-primary text-xs font-medium hover:underline">Xem tất cả</Link>
      </div>

      <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {alerts.slice(0, 3).map((alert: AlertDto) => (
          <li key={alert.id} className={`border-l-4 ${BORDER[alert.alertLevel ?? 'INFO'] ?? BORDER.INFO} bg-gray-50 rounded-r-md px-3 py-2`}>
            <p className="text-sm font-medium text-gray-900">{alert.stationName}</p>
            <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
            <p className="text-[11px] text-gray-400 mt-1 num">{new Date(alert.createdAt).toLocaleString('vi-VN')}</p>
          </li>
        ))}
      </ul>
      {alerts.length > 3 && <p className="text-xs text-gray-500 mt-2">và {alerts.length - 3} cảnh báo khác</p>}
    </div>
  );
}
