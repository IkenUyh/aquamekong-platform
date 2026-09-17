import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { forecastApi } from '../api/client';
import { ForecastChart } from './ForecastChart';
import { StatusBadge } from './shared/StatusBadge';
import type { Station } from '../types';

export function StationForecastCard({ station }: { station: Station }) {
  const { data: forecasts = [] } = useQuery({
    queryKey: ['forecasts', station.id],
    queryFn: () => forecastApi.getByStation(station.id),
  });

  const currentSalinity = station.latestSalinity || 0;
  const isHigh = currentSalinity >= 4;
  const trend = station.salinityLevel === 'CRITICAL' ? 'high' : station.salinityLevel === 'WARNING' ? 'rising' : 'stable';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-bold text-gray-800 flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isHigh ? 'bg-red-500' : 'bg-blue-500'}`} />
            {station.name}
          </h4>
          <p className="text-xs text-gray-500">{station.riverName || 'N/A'}</p>
          <p className="text-lg font-bold mt-1 text-gray-800">
            {currentSalinity}‰ <span className="text-xs font-normal text-gray-400">hiện tại</span>
          </p>
        </div>
        <StatusBadge level={isHigh ? 'CRITICAL' : trend === 'rising' ? 'WARNING' : trend === 'low' ? 'SAFE' : 'INFO'} />
      </div>
      <div className="h-[120px] -mx-2">
        <ForecastChart forecasts={forecasts} />
      </div>
    </div>
  );
}
