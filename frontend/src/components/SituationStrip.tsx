import React from 'react';
import { Link } from 'react-router-dom';
import type { AlertDto, Station } from '../types';
import { formatMeasuredAt, formatNumber, formatSalinity, SALINITY_THRESHOLD } from '../utils/salinity';

/** Số trạm vượt ngưỡng hiện đủ chi tiết; còn lại gộp vào một dòng */
const SHOWN = 3;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Cảnh báo độ mặn đang mở sớm nhất của trạm: từ lúc nào trạm vượt ngưỡng, và số đo lúc đó */
function firstOpenAlert(alerts: AlertDto[], stationId: number): AlertDto | undefined {
  return alerts
    .filter((a) => a.stationId === stationId && a.metricType === 'salinity')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

interface SituationStripProps {
  stations: Station[];
  openAlerts: AlertDto[];
  lastUpdate?: string;
  onSelect: (stationId: number) => void;
}

/**
 * Tình hình hôm nay: câu đầu tiên người xem đọc. Nêu tên từng trạm vượt ngưỡng (trung bình 40 trạm che mất trạm
 * bất thường), rồi một dòng cho các trạm còn lại bằng trung vị và mức cao nhất.
 */
export function SituationStrip({ stations, openAlerts, lastUpdate, onSelect }: SituationStripProps) {
  const measured = stations.filter((s) => s.latestSalinity != null);
  const exceeding = measured
    .filter((s) => s.latestSalinity! > SALINITY_THRESHOLD)
    .sort((a, b) => b.latestSalinity! - a.latestSalinity!);
  const rest = measured.filter((s) => s.latestSalinity! <= SALINITY_THRESHOLD);
  const restMedian = median(rest.map((s) => s.latestSalinity!));
  const restPeak = rest.reduce<Station | null>((top, s) => (top == null || s.latestSalinity! > top.latestSalinity! ? s : top), null);

  const alertLink = openAlerts.length > 0 && (
    <Link to="/alerts" className="text-sm font-medium text-primary hover:underline whitespace-nowrap">
      {openAlerts.length} cảnh báo chưa xử lý
    </Link>
  );
  const updated = lastUpdate && <span className="num">Số đo mới nhất {formatMeasuredAt(lastUpdate)}</span>;

  if (measured.length === 0) {
    return (
      <section className="card px-4 py-3 lg:px-5 text-sm text-gray-500" aria-label="Tình hình hôm nay">
        Chưa có số đo độ mặn.
      </section>
    );
  }

  const restLine = restPeak && (
    <>
      {exceeding.length > 0 ? `${rest.length} trạm còn lại dưới ngưỡng` : `${rest.length} trạm`}: trung vị{' '}
      <span className="num font-medium text-gray-900">{formatSalinity(restMedian)}‰</span>, cao nhất{' '}
      <span className="num font-medium text-gray-900">{formatSalinity(restPeak.latestSalinity)}‰</span> ở{' '}
      <button type="button" onClick={() => onSelect(restPeak.id)} className="font-medium text-gray-900 hover:underline">
        {restPeak.name}
      </button>.
    </>
  );

  if (exceeding.length === 0) {
    return (
      <section className="card px-4 py-4 lg:px-5" aria-labelledby="situation-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="situation-title" className="text-lg font-semibold text-gray-900 text-balance">
            Không trạm nào vượt ngưỡng {SALINITY_THRESHOLD}‰
          </h2>
          <div className="flex items-baseline gap-4 text-xs text-gray-500">{updated}{alertLink}</div>
        </div>
        <p className="mt-1 text-sm text-gray-600 text-pretty">{restLine}</p>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="situation-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-red-50 border-b border-red-100 px-4 py-3 lg:px-5">
        <h2 id="situation-title" className="text-lg font-semibold text-red-800 text-balance">
          {exceeding.length} trạm đang vượt ngưỡng {SALINITY_THRESHOLD}‰
        </h2>
        <div className="flex items-baseline gap-4 text-xs text-red-900/70">{updated}{alertLink}</div>
      </div>

      <ul className="divide-y divide-gray-100">
        {exceeding.slice(0, SHOWN).map((s) => {
          const alert = firstOpenAlert(openAlerts, s.id);
          const ratio = s.latestSalinity! / SALINITY_THRESHOLD;
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 lg:px-5">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-600">
                  {s.province}
                  {alert && (
                    <>
                      {s.province && ' · '}vượt ngưỡng từ <span className="num">{formatMeasuredAt(alert.createdAt, false)}</span>
                      {alert.measuredValue != null && (
                        <> (lúc đó <span className="num">{formatSalinity(alert.measuredValue)}‰</span>)</>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <p className="text-right">
                  <span className="block text-2xl font-semibold text-red-700 leading-tight">
                    {formatSalinity(s.latestSalinity)}<span className="ml-0.5 text-sm font-normal text-gray-500">‰</span>
                  </span>
                  <span className="text-xs text-gray-600">gấp {formatNumber(ratio, 1)} lần ngưỡng</span>
                </p>
                <button type="button" onClick={() => onSelect(s.id)} className="btn-secondary whitespace-nowrap">
                  Xem trên bản đồ
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {(exceeding.length > SHOWN || restLine) && (
        <p className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 lg:px-5 text-sm text-gray-600 text-pretty">
          {exceeding.length > SHOWN && <>Và {exceeding.length - SHOWN} trạm vượt ngưỡng khác trong bảng xếp hạng. </>}
          {restLine}
        </p>
      )}
    </section>
  );
}
