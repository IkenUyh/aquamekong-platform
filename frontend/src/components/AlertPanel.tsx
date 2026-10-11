import React from 'react';
import { Link } from 'react-router-dom';
import { useUnresolvedAlerts } from '../hooks/useAlerts';
import { useStationsList } from '../hooks/useStations';
import { StatusBadge } from './shared/StatusBadge';
import type { AlertDto } from '../types/alert';
import { formatMeasuredAt, formatSalinity, metricLabel } from '../utils/salinity';

const LEVEL = (a: AlertDto) => (a.alertLevel === 'CRITICAL' || a.alertLevel === 'WARNING' ? a.alertLevel : 'INFO');

/**
 * 3 cảnh báo chưa xử lý mới nhất. Số đo lúc cảnh báo có thể đã cũ nhiều ngày, nên với độ mặn hiện kèm số đo
 * mới nhất của trạm ("lúc cảnh báo 17,38‰ → hiện tại 24,37‰").
 */
export function AlertPanel() {
  const { data: alerts } = useUnresolvedAlerts();
  const { data: stations = [] } = useStationsList();

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Cảnh báo chưa xử lý <span className="num text-red-600">({alerts.length})</span>
        </h3>
        <Link to="/alerts" className="text-primary text-xs font-medium hover:underline whitespace-nowrap">Xem tất cả</Link>
      </div>

      <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {alerts.slice(0, 3).map((alert: AlertDto) => {
          const salinity = alert.metricType === 'salinity';
          const current = salinity ? stations.find((s) => s.id === alert.stationId)?.latestSalinity : null;
          const m = metricLabel(alert.metricType ?? '');
          return (
            <li key={alert.id} className="bg-gray-50 rounded-md px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{alert.stationName}</p>
                <StatusBadge level={LEVEL(alert)} />
              </div>
              {salinity && alert.measuredValue != null ? (
                <p className="text-xs text-gray-600 mt-0.5 num">
                  Lúc cảnh báo {formatSalinity(alert.measuredValue)}‰
                  {current != null && <> → hiện tại <span className="font-semibold text-gray-900">{formatSalinity(current)}‰</span></>}
                </p>
              ) : (
                <p className="text-xs text-gray-600 mt-0.5">{alert.message ?? m.label}</p>
              )}
              <p className="text-[11px] text-gray-500 mt-1 num">Cảnh báo {formatMeasuredAt(alert.createdAt)}</p>
            </li>
          );
        })}
      </ul>
      {alerts.length > 3 && <p className="text-xs text-gray-500 mt-2">và {alerts.length - 3} cảnh báo khác</p>}
    </div>
  );
}
