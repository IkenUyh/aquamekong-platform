import React from 'react';
import { useUnresolvedAlerts } from '../hooks/useAlerts';
import type { AlertDto } from '../types/alert';

const SEVERITY_STYLES: Record<string, { bg: string, border: string, icon: string, text: string }> = {
  CRITICAL: { bg: 'bg-red-50', border: 'border-red-200', icon: '🔴', text: 'text-red-700' },
  WARNING:  { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: '⚠️', text: 'text-yellow-700' },
  INFO:     { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'ℹ️', text: 'text-blue-700' },
};

export function AlertPanel() {
  const { data: alerts } = useUnresolvedAlerts();

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          Cảnh báo
          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
            {alerts.length}
          </span>
        </h3>
        <a href="#alerts" className="text-blue-500 text-xs hover:underline">Xem tất cả &gt;</a>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {alerts.slice(0, 3).map((alert: AlertDto) => {
          const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO;
          return (
            <div key={alert.id}
                 className={`${style.bg} ${style.border} border rounded-lg p-3 transition-all hover:shadow-md`}>
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">{style.icon}</span>
                <div>
                  <p className={`text-sm font-medium ${style.text}`}>
                    Vượt ngưỡng {alert.thresholdValue}‰
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Trạm {alert.stationName} ({alert.actualValue}‰)
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(alert.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {alerts.length > 3 && (
          <div className="text-center mt-2">
             <span className="text-xs text-gray-400">+{alerts.length - 3} cảnh báo khác...</span>
          </div>
        )}
      </div>
    </div>
  );
}
