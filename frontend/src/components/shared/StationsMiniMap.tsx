import React from 'react';
import { MiniMap } from './MiniMap';
import {
  classifySalinity, formatNumber, SALINITY_CLASS_COLORS, SALINITY_CLASS_LABELS, type SalinityClass,
} from '../../utils/salinity';

export interface StationPoint {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  /** Giá trị độ mặn để tô màu (hiện tại hoặc dự báo) */
  salinity: number | null | undefined;
}

const LEGEND_ORDER: SalinityClass[] = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

/** Bản đồ nhỏ các trạm, tô màu theo thang độ mặn chung của app (utils/salinity). */
export function StationsMiniMap({ stations, height = '100%', focusId = null }: { stations: StationPoint[]; height?: string; focusId?: number | null }) {
  const markers = stations.map((s) => ({
    id: s.id,
    lat: s.latitude,
    lng: s.longitude,
    color: SALINITY_CLASS_COLORS[classifySalinity(s.salinity)],
    label: `${s.name}: ${formatNumber(s.salinity)}‰`,
  }));

  return (
    <div className="relative h-full" style={{ height }}>
      <MiniMap markers={markers} height="100%" focusId={focusId} />
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow border border-gray-100 z-[1000] text-xs">
        <div className="font-semibold text-gray-700 mb-2">Độ mặn</div>
        {LEGEND_ORDER.map((c) => (
          <div key={c} className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SALINITY_CLASS_COLORS[c] }} />
            {SALINITY_CLASS_LABELS[c]}
          </div>
        ))}
      </div>
    </div>
  );
}
