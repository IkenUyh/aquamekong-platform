import { X, Droplets, Waves, Wind, MapPin, TrendingUp } from 'lucide-react';
import { ForecastChart } from './ForecastChart';
import { useStationMetrics } from '../hooks/useWaterMetrics';
import { useForecast } from '../hooks/useForecast';
import type { Station } from '../types';

interface StationPanelProps {
  station: Station;
  onClose: () => void;
}

const LEVEL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  LOW:     { bg: 'bg-green-500/15', text: 'text-green-400', label: 'An toàn' },
  MEDIUM:  { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Cảnh báo' },
  HIGH:    { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Nguy hiểm' },
  UNKNOWN: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Không rõ' },
};

export function StationPanel({ station, onClose }: StationPanelProps) {
  const { data: metrics } = useStationMetrics(station.id);
  const { data: forecasts } = useForecast(station.id);
  const levelStyle = LEVEL_STYLES[station.salinityLevel || 'UNKNOWN'];

  return (
    <div className="absolute top-4 right-4 z-[1000] w-[360px] max-h-[calc(100vh-2rem)] glass-card 
                    overflow-y-auto animate-fade-in shadow-2xl"
         id="station-panel"
    >
      {/* Header */}
      <div className="sticky top-0 bg-dark-surface/95 backdrop-blur-xl p-4 border-b border-dark-border/30 flex items-start justify-between">
        <div>
          <h2 className="font-bold text-white text-base">{station.name}</h2>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" />
            {station.province} • {station.code}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-dark-card/60 transition-colors text-slate-400 hover:text-white"
          id="close-station-panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status badge */}
      <div className="px-4 pt-3">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold 
                        ${levelStyle.bg} ${levelStyle.text} border border-current/20`}>
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
          {levelStyle.label}
        </div>
      </div>

      {/* Current metrics */}
      <div className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chỉ số hiện tại</h3>
        
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card p-3 text-center">
            <Droplets className="w-5 h-5 text-cyan-400 mx-auto mb-1.5" />
            <p className="text-lg font-bold font-mono text-white">
              {station.latestSalinity ?? '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Độ mặn (‰)</p>
          </div>
          <div className="glass-card p-3 text-center">
            <Waves className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
            <p className="text-lg font-bold font-mono text-white">
              {station.latestWaterLevel ?? '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Mực nước (m)</p>
          </div>
          <div className="glass-card p-3 text-center">
            <Wind className="w-5 h-5 text-teal-400 mx-auto mb-1.5" />
            <p className="text-lg font-bold font-mono text-white">
              {station.latestFlowRate ?? '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Lưu lượng</p>
          </div>
        </div>
      </div>

      {/* Forecast chart */}
      {forecasts && forecasts.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Dự báo độ mặn
          </h3>
          <ForecastChart forecasts={forecasts} />
        </div>
      )}

      {/* Recent history */}
      {metrics && metrics.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Lịch sử gần đây
          </h3>
          <div className="space-y-1">
            {metrics.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded 
                                         hover:bg-dark-card/30 transition-colors">
                <span className="text-slate-500 font-mono">
                  {new Date(m.recordedAt).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-mono">{m.salinity}‰</span>
                  <span className="text-blue-400 font-mono">{m.waterLevel}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* River info */}
      <div className="px-4 pb-4 border-t border-dark-border/20 pt-3">
        <p className="text-xs text-slate-500">
          🏞️ <span className="text-slate-300">{station.riverName}</span>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          📍 <span className="text-slate-400">{station.latitude?.toFixed(4)}°N, {station.longitude?.toFixed(4)}°E</span>
        </p>
      </div>
    </div>
  );
}
