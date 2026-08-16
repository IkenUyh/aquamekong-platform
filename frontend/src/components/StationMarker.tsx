import { CircleMarker, Popup } from 'react-leaflet';
import { Droplets, Waves, Wind } from 'lucide-react';
import type { GeoJsonFeature, SalinityLevel } from '../types';

interface StationMarkerProps {
  feature: GeoJsonFeature;
  isSelected: boolean;
  onClick: () => void;
}

const SALINITY_COLORS: Record<SalinityLevel, string> = {
  LOW:     '#22c55e',
  MEDIUM:  '#eab308',
  HIGH:    '#ef4444',
  UNKNOWN: '#94a3b8',
};

const SALINITY_LABELS: Record<SalinityLevel, string> = {
  LOW:     'An toàn',
  MEDIUM:  'Cảnh báo',
  HIGH:    'Nguy hiểm',
  UNKNOWN: 'Không rõ',
};

export function StationMarker({ feature, isSelected, onClick }: StationMarkerProps) {
  const { geometry, properties } = feature;
  const [lng, lat] = geometry.coordinates;
  const level = (properties.salinityLevel || 'UNKNOWN') as SalinityLevel;
  const color = SALINITY_COLORS[level];

  return (
    <>
      {/* Glow ring effect */}
      <CircleMarker
        center={[lat, lng]}
        radius={isSelected ? 18 : 14}
        pathOptions={{
          color: color,
          fillColor: color,
          fillOpacity: 0.15,
          weight: 1,
          opacity: 0.4,
        }}
      />

      {/* Main marker */}
      <CircleMarker
        center={[lat, lng]}
        radius={isSelected ? 10 : 7}
        pathOptions={{
          color: '#1e293b',
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2,
        }}
        eventHandlers={{ click: onClick }}
      >
        <Popup>
          <div className="min-w-[220px]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dark-border/50">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div>
                <h3 className="font-bold text-sm text-white">{properties.name}</h3>
                <p className="text-xs text-slate-400">{properties.code} • {properties.province}</p>
              </div>
            </div>

            {/* River */}
            <p className="text-xs text-aqua-400 mb-3">🏞️ {properties.riverName}</p>

            {/* Metrics */}
            <div className="space-y-2">
              <MetricRow
                icon="💧"
                label="Độ mặn"
                value={properties.latestSalinity}
                unit="‰"
                level={level}
              />
              <MetricRow
                icon="🌊"
                label="Mực nước"
                value={properties.latestWaterLevel}
                unit="m"
              />
              <MetricRow
                icon="💨"
                label="Lưu lượng"
                value={properties.latestFlowRate}
                unit="m³/s"
              />
            </div>

            {/* Status badge */}
            <div className="mt-3 pt-2 border-t border-dark-border/50 flex justify-between items-center">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${color}22`,
                  color: color,
                  border: `1px solid ${color}44`,
                }}
              >
                {SALINITY_LABELS[level]}
              </span>
              <span className="text-[10px] text-slate-500">{properties.status}</span>
            </div>
          </div>
        </Popup>
      </CircleMarker>
    </>
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
  level?: SalinityLevel;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">
        {icon} {label}
      </span>
      <span
        className="font-mono font-semibold"
        style={{
          color: level ? SALINITY_COLORS[level] : '#e2e8f0',
        }}
      >
        {value !== null && value !== undefined ? `${value} ${unit}` : '—'}
      </span>
    </div>
  );
}
