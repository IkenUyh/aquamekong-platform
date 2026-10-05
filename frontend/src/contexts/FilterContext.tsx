import React, { createContext, useContext, useState } from 'react';
import { endOfDay, subHours } from 'date-fns';

interface FilterState {
  // Date range
  startDate: Date;
  endDate: Date;

  // Selected station
  selectedStationId: number | null;

  // Map layers
  activeLayers: Record<string, boolean>;
}

interface FilterContextType extends FilterState {
  setDateRange: (start: Date, end: Date) => void;
  setSelectedStation: (id: number | null) => void;
  toggleLayer: (layerId: string) => void;
}

const HEAT_LAYERS = ['salinity', 'waterLevel', 'flowRate'];

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FilterState>({
    // Mặc định 24 giờ qua (đầu ngày thì "hôm nay" gần như chưa có số đo)
    startDate: subHours(new Date(), 24),
    endDate: endOfDay(new Date()),
    selectedStationId: null,
    activeLayers: {
      salinity: true,
      waterLevel: false,
      flowRate: false,
      provinces: true,
      rivers: true,
    },
  });

  const setDateRange = (start: Date, end: Date) =>
    setState(prev => ({ ...prev, startDate: start, endDate: end }));

  const setSelectedStation = (id: number | null) =>
    setState(prev => ({ ...prev, selectedStationId: id }));

  // Các lớp nhiệt (salinity/waterLevel/flowRate) loại trừ nhau: bật một lớp thì tắt hai lớp kia
  const toggleLayer = (layerId: string) =>
    setState(prev => {
      const turningOn = !prev.activeLayers[layerId];
      const next = { ...prev.activeLayers, [layerId]: turningOn };
      if (turningOn && HEAT_LAYERS.includes(layerId)) {
        HEAT_LAYERS.filter((l) => l !== layerId).forEach((l) => { next[l] = false; });
      }
      return { ...prev, activeLayers: next };
    });

  return (
    <FilterContext.Provider value={{ ...state, setDateRange, setSelectedStation, toggleLayer }}>
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
