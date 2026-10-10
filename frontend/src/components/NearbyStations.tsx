import React from 'react';
import { useMyLocation } from '../hooks/useMyLocation';
import { isNativeApp } from '../platform';
import type { Station } from '../types';
import { formatDistance, nearestStations } from '../utils/geo';
import {
  classifySalinity, formatMeasuredAt, formatNumber, isReporting, SALINITY_CLASS_COLORS, SALINITY_CLASS_SHORT_LABELS,
} from '../utils/salinity';

/** Xa hơn mức này thì số đo của trạm khó đại diện cho chỗ người dùng */
const FAR_KM = 30;

const DENIED_HINT = isNativeApp
  ? 'App chưa được phép lấy vị trí. Mở Cài đặt điện thoại → Ứng dụng → AquaMekong → Quyền → Vị trí để cho phép.'
  : 'Trang chưa được phép lấy vị trí. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → Vị trí → Cho phép, rồi bấm lại.';

/**
 * Ba trạm gần người dùng nhất với độ mặn mới nhất. Tính ngay trên máy từ danh sách trạm, vị trí không gửi lên máy chủ.
 * Bấm vào trạm thì gọi onSelect (trang Tổng quan đưa bản đồ tới trạm đó).
 */
export function NearbyStations({ stations, onSelect }: { stations: Station[]; onSelect: (id: number) => void }) {
  const { position, status, locate, forget } = useMyLocation();
  const active = stations.filter((s) => s.status === 'ACTIVE');
  const nearby = position ? nearestStations(active, position, 3) : [];

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Trạm gần bạn</h2>
        {status === 'ready' && (
          <div className="flex items-baseline gap-3 text-xs">
            <button type="button" onClick={() => locate()} className="font-medium text-primary hover:underline">Cập nhật vị trí</button>
            <button type="button" onClick={forget} className="text-gray-500 hover:underline">Xoá vị trí</button>
          </div>
        )}
      </div>

      {status !== 'ready' || nearby.length === 0 ? (
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-gray-600 flex-1">
            {status === 'denied' ? DENIED_HINT
              : status === 'unavailable' ? 'Không lấy được vị trí trên thiết bị này. Bạn vẫn có thể chọn trạm trên bản đồ.'
              : 'Xem độ mặn ở các trạm quan trắc gần nơi bạn ở. Vị trí chỉ dùng trên máy này, không gửi lên máy chủ.'}
          </p>
          <button type="button" onClick={() => locate()} disabled={status === 'locating'} className="btn-primary shrink-0">
            {status === 'locating' ? 'Đang lấy vị trí...' : 'Tìm trạm gần tôi'}
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {nearby.map(({ station, km }) => {
              const level = classifySalinity(station.latestSalinity);
              return (
                <li key={station.id}>
                  <button type="button" onClick={() => onSelect(station.id)}
                    className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                    <p className="text-sm font-medium text-gray-900 truncate">{station.name}</p>
                    <p className="text-xs text-gray-500 num">cách {formatDistance(km)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm num">
                      <span className="dot" style={{ backgroundColor: SALINITY_CLASS_COLORS[level] }} />
                      <span className="font-semibold text-gray-900">{formatNumber(station.latestSalinity)}‰</span>
                      <span className="text-xs text-gray-500">{SALINITY_CLASS_SHORT_LABELS[level]}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 num">
                      {station.lastMeasuredAt
                        ? isReporting(station.lastMeasuredAt) ? formatMeasuredAt(station.lastMeasuredAt) : 'mất tín hiệu'
                        : 'chưa có số đo'}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          {nearby[0].km > FAR_KM && (
            <p className="mt-2 text-xs text-gray-500">
              Trạm gần nhất cách {formatDistance(nearby[0].km)}: độ mặn nơi bạn ở có thể khác nhiều so với số đo tại trạm.
            </p>
          )}
        </>
      )}
    </section>
  );
}
