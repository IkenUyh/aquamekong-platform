import { Search, MapPin, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { MetricCard } from './MetricCard';
import type { Station } from '../types';

interface SidebarProps {
  stations: Station[];
  selectedStationId: number | null;
  onSelectStation: (id: number) => void;
  isLoading: boolean;
}

const SALINITY_COLORS: Record<string, string> = {
  LOW:     'bg-green-500',
  MEDIUM:  'bg-yellow-500',
  HIGH:    'bg-red-500',
  UNKNOWN: 'bg-slate-500',
};

export function Sidebar({ stations, selectedStationId, onSelectStation, isLoading }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStations = stations.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.province.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Summary metrics
  const totalStations = stations.length;
  const highAlertCount = stations.filter((s) => s.salinityLevel === 'HIGH').length;
  const mediumAlertCount = stations.filter((s) => s.salinityLevel === 'MEDIUM').length;
  const avgSalinity =
    stations.length > 0
      ? stations.reduce((sum, s) => sum + (s.latestSalinity || 0), 0) / stations.length
      : 0;

  return (
    <div className="flex flex-col h-full w-[380px]" id="sidebar">
      {/* Header */}
      <div className="p-5 border-b border-dark-border/30">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🌊</span>
          AquaMekong
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Giám sát Thủy văn & Xâm nhập mặn ĐBSCL
        </p>
      </div>

      {/* Summary cards */}
      <div className="p-4 grid grid-cols-2 gap-2">
        <MetricCard
          label="Trạm đo"
          value={totalStations}
          icon="📡"
          color="text-aqua-400"
        />
        <MetricCard
          label="TB Độ mặn"
          value={`${avgSalinity.toFixed(1)}‰`}
          icon="💧"
          color="text-blue-400"
        />
        <MetricCard
          label="Cảnh báo"
          value={mediumAlertCount}
          icon="⚠️"
          color="text-yellow-400"
        />
        <MetricCard
          label="Nguy hiểm"
          value={highAlertCount}
          icon="🔴"
          color="text-red-400"
        />
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm trạm đo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-card/60 border border-dark-border/40 rounded-lg py-2.5 pl-10 pr-4
                       text-sm text-white placeholder-slate-500 focus:outline-none focus:border-aqua-500/50
                       focus:ring-1 focus:ring-aqua-500/30 transition-all"
            id="station-search"
          />
        </div>
      </div>

      {/* Station list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
            <div className="animate-spin w-5 h-5 border-2 border-aqua-500 border-t-transparent rounded-full mr-3" />
            Đang tải...
          </div>
        ) : filteredStations.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Không tìm thấy trạm nào
          </div>
        ) : (
          filteredStations.map((station) => (
            <button
              key={station.id}
              onClick={() => onSelectStation(station.id)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-3
                         hover:bg-dark-card/60 cursor-pointer group ${
                           selectedStationId === station.id
                             ? 'bg-aqua-900/30 border border-aqua-500/30'
                             : 'border border-transparent'
                         }`}
              id={`station-item-${station.id}`}
            >
              {/* Salinity indicator */}
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${SALINITY_COLORS[station.salinityLevel || 'UNKNOWN']}`} />

              {/* Station info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-white truncate">{station.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 font-mono">{station.code}</span>
                  <span className="text-[10px] text-slate-600">•</span>
                  <MapPin className="w-2.5 h-2.5 text-slate-500" />
                  <span className="text-[10px] text-slate-500">{station.province}</span>
                </div>
              </div>

              {/* Salinity value */}
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-bold font-mono text-white">
                  {station.latestSalinity !== null ? station.latestSalinity : '—'}
                </span>
                <span className="text-[10px] text-slate-500 ml-0.5">‰</span>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-aqua-400 transition-colors flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
