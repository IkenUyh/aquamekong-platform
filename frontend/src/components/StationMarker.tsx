import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

import type { GeoJsonFeature } from '../types';
import {
  classifySalinity, formatNumber, SALINITY_CLASS_COLORS, SALINITY_CLASS_SHORT_LABELS, type SalinityClass,
} from '../utils/salinity';

interface StationMarkerProps {
  feature: GeoJsonFeature;
  isSelected: boolean;
  onClick: () => void;
}

function createLabelIcon(name: string, salinity: number | null, level: SalinityClass, isSelected: boolean): L.DivIcon {
  const color = SALINITY_CLASS_COLORS[level];
  const scale = isSelected ? 1.1 : 1;
  const shadow = isSelected ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)';
  const border = isSelected ? `2px solid ${color}` : `1px solid ${color}`;
  
  return L.divIcon({
    className: 'station-label-marker',
    html: `
      <div style="
        background: white;
        border: ${border};
        border-radius: 8px;
        padding: 4px 8px;
        font-family: Inter, system-ui, sans-serif;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: ${shadow};
        text-align: center;
        transform: scale(${scale});
        transition: all 0.2s;
        cursor: pointer;
      ">
        <div style="font-size: 11px; color: #4A5568;">${name}</div>
        <div style="color: ${color}; font-size: 14px;">
          ${salinity !== null ? formatNumber(salinity, 1) + '‰' : '—'}
        </div>
      </div>
    `,
    iconSize: [80, 44],
    iconAnchor: [40, 22],
  });
}

export function StationMarker({ feature, isSelected, onClick }: StationMarkerProps) {
  const { geometry, properties } = feature;
  const [lng, lat] = geometry.coordinates;
  // Phân loại từ giá trị (cùng thang với chú giải), không phụ thuộc salinityLevel do backend gửi
  const level = classifySalinity(properties.latestSalinity);

  return (
    <Marker
      position={[lat, lng]}
      icon={createLabelIcon(properties.name, properties.latestSalinity ?? null, level, isSelected)}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <div className="min-w-[220px]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: SALINITY_CLASS_COLORS[level] }}
            />
            <div>
              <h3 className="font-bold text-sm text-gray-800">{properties.name}</h3>
              <p className="text-xs text-gray-500">{properties.code} • {properties.province}</p>
            </div>
          </div>

          {/* River */}
          <p className="text-xs text-blue-500 mb-3">🏞️ {properties.riverName ?? '—'}</p>

          {/* Metrics */}
          <div className="space-y-2">
            <MetricRow
              icon="💧"
              label="Độ mặn"
              value={properties.latestSalinity ?? null}
              unit="‰"
              level={level}
            />
            <MetricRow
              icon="🌊"
              label="Mực nước"
              value={properties.latestWaterLevel ?? null}
              unit="m"
            />
            <MetricRow
              icon="💨"
              label="Lưu lượng"
              value={properties.latestFlowRate ?? null}
              unit="m³/s"
            />
          </div>

          {/* Status badge */}
          <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${SALINITY_CLASS_COLORS[level]}22`,
                color: SALINITY_CLASS_COLORS[level],
                border: `1px solid ${SALINITY_CLASS_COLORS[level]}44`,
              }}
            >
              {SALINITY_CLASS_SHORT_LABELS[level]}
            </span>
            <span className="text-[10px] text-gray-400">
              {properties.lastMeasuredAt ? `Đo lúc ${new Date(properties.lastMeasuredAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : 'Chưa có số đo'}
            </span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function MetricRow({
  icon,
  label,
  value,
  unit,
  level,
}: {
  icon: string;
  label: string;
  value: number | null;
  unit: string;
  level?: SalinityClass;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">
        {icon} {label}
      </span>
      <span
        className="font-medium"
        style={{
          color: level ? SALINITY_CLASS_COLORS[level] : '#4A5568',
        }}
      >
        {value !== null && value !== undefined ? `${formatNumber(value)} ${unit}` : '—'}
      </span>
    </div>
  );
}
