import React from 'react';

export interface MapLayer {
  id: string;
  label: string;
  enabled: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_LAYERS: MapLayer[] = [
  { id: 'provinces',   label: 'Ranh giới tỉnh', enabled: true },
  { id: 'rivers',      label: 'Sông, kênh', enabled: true },
];

interface MapLayerTogglesProps {
  layers: MapLayer[];
  onToggle: (layerId: string) => void;
}

export function MapLayerToggles({ layers, onToggle }: MapLayerTogglesProps) {
  return (
    <div className="space-y-2">
      <p className="field-label">Lớp bản đồ</p>
      <div className="space-y-1">
        {layers.map(layer => (
          <div key={layer.id}
               className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50">
            <span className="text-sm text-gray-700">{layer.label}</span>
            {/* Toggle switch */}
            <button
              role="switch"
              aria-checked={layer.enabled}
              aria-label={layer.label}
              onClick={() => onToggle(layer.id)}
              className={`w-10 h-5 rounded-full transition-colors relative
                         ${layer.enabled ? 'bg-primary' : 'bg-gray-300'}`}
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
