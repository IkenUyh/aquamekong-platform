import React, { createContext, useContext, useState } from 'react';
import { endOfDay, subHours } from 'date-fns';
import type { ColorMetric } from '../utils/metricScales';

interface FilterState {
  // Date range
  startDate: Date;
  endDate: Date;

  // Selected station
  selectedStationId: number | null;

  // Map layers (ranh giới tỉnh, sông kênh)
  activeLayers: Record<string, boolean>;

  // Chỉ số dùng để tô màu marker trạm
  colorMetric: ColorMetric;
}

interface FilterContextType extends FilterState {
  setDateRange: (start: Date, end: Date) => void;
  setSelectedStation: (id: number | null) => void;
  toggleLayer: (layerId: string) => void;
  setColorMetric: (metric: ColorMetric) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FilterState>({
    // Mặc định 24 giờ qua (đầu ngày thì "hôm nay" gần như chưa có số đo)
    startDate: subHours(new Date(), 24),
    endDate: endOfDay(new Date()),
    selectedStationId: null,
    activeLayers: {
      provinces: true,
      rivers: true,
    },
    colorMetric: 'salinity',
  });

  const setDateRange = (start: Date, end: Date) =>
    setState(prev => ({ ...prev, startDate: start, endDate: end }));

  const setSelectedStation = (id: number | null) =>
    setState(prev => ({ ...prev, selectedStationId: id }));

  const toggleLayer = (layerId: string) =>
    setState(prev => ({ ...prev, activeLayers: { ...prev.activeLayers, [layerId]: !prev.activeLayers[layerId] } }));

  const setColorMetric = (metric: ColorMetric) =>
    setState(prev => ({ ...prev, colorMetric: metric }));

  return (
    <FilterContext.Provider value={{ ...state, setDateRange, setSelectedStation, toggleLayer, setColorMetric }}>
      {children}
    </FilterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilters must be used within FilterProvider');
  return context;
}
