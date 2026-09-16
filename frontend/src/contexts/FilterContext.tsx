import React, { createContext, useContext, useState } from 'react';
import { startOfDay, endOfDay } from 'date-fns';

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

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FilterState>({
    startDate: startOfDay(new Date()),
    endDate: endOfDay(new Date()),
    selectedStationId: null,
    activeLayers: {
      salinity: true,
      waterLevel: false,
      flowRate: false,
      rainfall: false,
      provinces: true,
      rivers: true,
    },
  });

  const setDateRange = (start: Date, end: Date) =>
    setState(prev => ({ ...prev, startDate: start, endDate: end }));

  const setSelectedStation = (id: number | null) =>
    setState(prev => ({ ...prev, selectedStationId: id }));

  const toggleLayer = (layerId: string) =>
    setState(prev => ({
      ...prev,
      activeLayers: {
        ...prev.activeLayers,
        [layerId]: !prev.activeLayers[layerId],
      },
    }));

  return (
    <FilterContext.Provider value={{ ...state, setDateRange, setSelectedStation, toggleLayer }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilters must be used within FilterProvider');
  return context;
}
