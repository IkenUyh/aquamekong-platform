import React from 'react';
import { Droplets, Waves, Wind, CloudRain, Map, Navigation } from 'lucide-react';

export interface MapLayer {
  id: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

export const DEFAULT_LAYERS: MapLayer[] = [
  { id: 'salinity',    label: 'Độ mặn (‰)',    icon: <Droplets className="w-4 h-4" />,  enabled: true },
  { id: 'waterLevel',  label: 'Mực nước',      icon: <Waves className="w-4 h-4" />,     enabled: false },
  { id: 'flowRate',    label: 'Lưu lượng',     icon: <Wind className="w-4 h-4" />,      enabled: false },
  { id: 'rainfall',    label: 'Lượng mưa',     icon: <CloudRain className="w-4 h-4" />, enabled: false },
  { id: 'provinces',   label: 'Ranh giới tỉnh', icon: <Map className="w-4 h-4" />,       enabled: true },
  { id: 'rivers',      label: 'Sông, kênh',    icon: <Navigation className="w-4 h-4" />,enabled: true },
];

interface MapLayerTogglesProps {
  layers: MapLayer[];
  onToggle: (layerId: string) => void;
}

export function MapLayerToggles({ layers, onToggle }: MapLayerTogglesProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Lớp bản đồ
      </label>
      <div className="space-y-1">
        {layers.map(layer => (
          <div key={layer.id}
               className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <div className={layer.enabled ? 'text-blue-500' : 'text-gray-400'}>
                {layer.icon}
              </div>
              <span className="text-sm text-gray-700">{layer.label}</span>
            </div>
            {/* Toggle switch */}
            <button
              onClick={() => onToggle(layer.id)}
              className={`w-10 h-5 rounded-full transition-colors relative
                         ${layer.enabled ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                              ${layer.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
