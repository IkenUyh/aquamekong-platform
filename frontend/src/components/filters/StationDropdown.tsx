import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Station } from '../../types';

interface StationDropdownProps {
  stations: Station[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}

export function StationDropdown({ stations, selectedId, onChange }: StationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = stations.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  const selected = stations.find(s => s.id === selectedId);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Chọn trạm
      </label>
      <div className="relative">
        {/* Trigger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-white border border-gray-300
                     rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:border-blue-400 transition"
        >
          <span>{selected ? selected.name : 'Tất cả trạm'}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200
                          rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
            {/* Search */}
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Tìm trạm..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* "All stations" option */}
            <button
              onClick={() => { onChange(null); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50
                         ${selectedId === null ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'}`}
            >
              Tất cả trạm
            </button>

            {/* Station options */}
            {filtered.map(station => (
              <button
                key={station.id}
                onClick={() => { onChange(station.id); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2
                           ${selectedId === station.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'}`}
              >
                <div className={`w-2 h-2 rounded-full ${station.salinityLevel === 'HIGH' ? 'bg-red-500' : station.salinityLevel === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <span>{station.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{station.latestSalinity}‰</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
