import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';

import type { GeoJsonFeature } from '../types';
import {
  classifySalinity, formatNumber, SALINITY_CLASS_COLORS, SALINITY_CLASS_SHORT_LABELS, type SalinityClass,
} from '../utils/salinity';
import { METRIC_SCALES, type ColorMetric } from '../utils/metricScales';

interface StationMarkerProps {
  feature: GeoJsonFeature;
  isSelected: boolean;
  onClick: () => void;
  /** Chỉ số quyết định màu và con số trên marker */
  metric: ColorMetric;
  /** Hiện tên trạm ngay trên marker (khi phóng to đủ gần) */
  showName: boolean;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * Marker gọn: chấm màu + giá trị, căn giữa đúng toạ độ trạm. Tên trạm chỉ hiện khi được chọn
 * hoặc khi phóng to, còn lại xem bằng tooltip, để 40 trạm không đè lên nhau.
 */
function createStationIcon(name: string, valueText: string, color: string, isSelected: boolean, showName: boolean): L.DivIcon {
  const nameLine = isSelected || showName
    ? `<div style="font-size:11px;font-weight:500;color:#4A5568;margin-bottom:1px">${escapeHtml(name)}</div>`
    : '';
  return L.divIcon({
    className: 'station-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `
      <div style="
        position:absolute; transform:translate(-50%,-50%);
        background:white; border:${isSelected ? '2px solid #0F3D5E' : '1px solid #cbd5e1'};
        border-radius:${nameLine ? '8px' : '9999px'}; padding:${nameLine ? '3px 8px' : '2px 7px 2px 5px'};
        font-family:Inter,system-ui,sans-serif; white-space:nowrap; text-align:center; cursor:pointer;
        box-shadow:${isSelected ? '0 4px 12px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.15)'};
        z-index:${isSelected ? 1 : 0};
      ">
        ${nameLine}
        <div style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#1f2937">
          <span style="width:9px;height:9px;border-radius:50%;background:${color};box-shadow:inset 0 0 0 1px rgba(0,0,0,0.2)"></span>
          ${valueText}
        </div>
      </div>
    `,
  });
}

export function StationMarker({ feature, isSelected, onClick, metric, showName }: StationMarkerProps) {
  const { geometry, properties } = feature;
  const [lng, lat] = geometry.coordinates;
  // Phân loại từ giá trị (cùng thang với chú giải), không phụ thuộc salinityLevel do backend gửi
  const level = classifySalinity(properties.latestSalinity);
  const scale = METRIC_SCALES[metric];
  const value = scale.value(properties);
  const valueText = value == null ? '—' : `${formatNumber(value, scale.digits)} ${scale.unit}`;
  const bin = scale.binOf(value);
  // Trạm sát nhau thì nhãn đè lên nhau: mức cao hơn nằm trên (bins xếp từ cao xuống thấp, "chưa có dữ liệu" cuối).
  // Bước 100 lớn hơn chênh lệch toạ độ y (Leaflet xếp theo y) giữa hai marker đang đè nhau.
  const rank = scale.bins.length - scale.bins.findIndex((b) => b.key === bin.key);

  return (
    <Marker
      position={[lat, lng]}
      icon={createStationIcon(properties.name, valueText, bin.color, isSelected, showName)}
      eventHandlers={{ click: onClick }}
      zIndexOffset={isSelected ? 10000 : rank * 100}
    >
      {!isSelected && !showName && (
        <Tooltip direction="top" offset={[0, -12]}>{properties.name}</Tooltip>
      )}
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
          <p className="text-xs text-gray-500 mb-3">{properties.riverName ?? '—'}</p>

          {/* Metrics */}
          <div className="space-y-2">
            <MetricRow
              label="Độ mặn"
              value={properties.latestSalinity ?? null}
              unit="‰"
              level={level}
            />
            <MetricRow
              label="Mực nước"
              value={properties.latestWaterLevel ?? null}
              unit="m"
            />
            <MetricRow
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
  label,
  value,
  unit,
  level,
}: {
  label: string;
  value: number | null;
  unit: string;
  level?: SalinityClass;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">
        {label}
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
