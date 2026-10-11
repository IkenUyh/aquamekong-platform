import React, { useState } from 'react';
import type { AlertDto, AlertStatus, Station } from '../types';
import { StatusBadge } from './shared/StatusBadge';
import { formatMeasuredAt, formatNumber, formatSalinity, metricLabel } from '../utils/salinity';

const DAY = 86_400_000;
const PAGE = 20;

const STATUS: Record<AlertStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang mở', className: 'bg-red-50 text-red-700' },
  ACKNOWLEDGED: { label: 'Đã xác nhận', className: 'bg-amber-50 text-amber-800' },
  RESOLVED: { label: 'Đã xử lý', className: 'bg-green-50 text-green-800' },
};

const levelOf = (a: AlertDto) => (a.alertLevel === 'CRITICAL' || a.alertLevel === 'WARNING' ? a.alertLevel : 'INFO');

/** Số ngày từ lúc cảnh báo tới lúc xử lý, hoặc tới nay nếu còn mở */
function durationDays(a: AlertDto, now: number): number {
  const end = a.status === 'RESOLVED' && a.resolvedAt ? new Date(a.resolvedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(a.createdAt).getTime()) / DAY));
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 num">{children}</p>
    </div>
  );
}

interface AlertCardListProps {
  alerts: AlertDto[];
  stations: Station[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  emptyText: string;
}

/**
 * Danh sách cảnh báo dạng thẻ: mỗi cảnh báo kể đủ câu chuyện của nó (lúc cảnh báo bao nhiêu, giờ bao nhiêu,
 * gấp mấy lần ngưỡng, kéo dài mấy ngày) thay cho một dòng bảng chỉ có số lúc cảnh báo.
 */
export function AlertCardList({ alerts, stations, selectedId, onSelect, emptyText }: AlertCardListProps) {
  const [shown, setShown] = useState(PAGE);
  const now = Date.now();

  if (alerts.length === 0) {
    return <p className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {alerts.slice(0, shown).map((a) => {
          const m = metricLabel(a.metricType ?? '');
          const salinity = a.metricType === 'salinity';
          const fmt = (v: number | null | undefined) => (salinity ? formatSalinity(v) : formatNumber(v));
          const current = salinity ? stations.find((s) => s.id === a.stationId)?.latestSalinity ?? null : null;
          const delta = current != null && a.measuredValue != null ? current - a.measuredValue : null;
          const ratio = a.measuredValue != null && a.thresholdValue ? (current ?? a.measuredValue) / a.thresholdValue : null;
          const days = durationDays(a, now);
          const status = STATUS[a.status ?? 'ACTIVE'];
          const selected = a.id === selectedId;
          return (
            <li key={a.id}>
              <button type="button" onClick={() => onSelect(a.id)} aria-pressed={selected}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${selected ? 'border-primary-300 bg-primary-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-gray-900">{a.stationName ?? `Trạm ${a.stationId}`}</span>
                    {a.province && <span className="text-sm text-gray-500">{a.province}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge level={levelOf(a)} />
                    <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${status.className}`}>{status.label}</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Fact label={`${m.label} lúc cảnh báo`}>
                    <span className="font-semibold">{fmt(a.measuredValue)}{m.unit}</span>
                  </Fact>
                  <Fact label="Hiện tại">
                    {current != null ? (
                      <>
                        <span className={`font-semibold ${a.thresholdValue != null && current > a.thresholdValue ? 'text-red-700' : ''}`}>{fmt(current)}{m.unit}</span>
                        {delta != null && Math.abs(delta) >= 0.01 && (
                          <span className="ml-1 text-xs text-gray-500">({delta > 0 ? 'tăng' : 'giảm'} {fmt(Math.abs(delta))}{m.unit})</span>
                        )}
                      </>
                    ) : '—'}
                  </Fact>
                  <Fact label="Ngưỡng">
                    {formatNumber(a.thresholdValue)}{m.unit}
                    {ratio != null && ratio > 1 && <span className="ml-1 text-xs text-gray-500">(gấp {formatNumber(ratio, 1)} lần)</span>}
                  </Fact>
                  <Fact label={a.status === 'RESOLVED' ? 'Đã kéo dài' : 'Đang kéo dài'}>
                    {days === 0 ? 'dưới 1 ngày' : `${days} ngày`}
                    <span className="ml-1 text-xs text-gray-500">(từ {formatMeasuredAt(a.createdAt, false)})</span>
                  </Fact>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {alerts.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn-secondary w-full">
          Xem thêm {Math.min(PAGE, alerts.length - shown)} cảnh báo
        </button>
      )}
    </div>
  );
}
