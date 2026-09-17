import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DataTable, Column } from '../components/shared/DataTable';
import { useStationsList } from '../hooks/useStations';
import { StatusBadge } from '../components/shared/StatusBadge';
import { MiniMap } from '../components/shared/MiniMap';
import { Search } from 'lucide-react';
import type { Station } from '../types';

export function StationsPage() {
  const { data: stationsList = [] } = useStationsList();
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(stationsList.length / itemsPerPage);
  const currentData = stationsList.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const provinces = [...new Set(stationsList.map(s => s.province).filter(Boolean))];
  const rivers = [...new Set(stationsList.map(s => s.riverName).filter(Boolean))];

  const columns: Column<Station>[] = [
    { key: 'name', header: 'Tên trạm', render: (s) => <span className="font-semibold text-gray-800">{s.name}</span> },
    { key: 'river', header: 'Sông', render: (s) => s.riverName },
    { key: 'province', header: 'Tỉnh/Thành', render: (s) => s.province },
    { key: 'type', header: 'Loại dữ liệu', render: () => 'Độ mặn + Mực nước' },
    { 
      key: 'salinity', 
      header: 'Độ mặn (‰)', 
      render: (s) => (
        <span className={s.latestSalinity && s.latestSalinity >= 4 ? 'text-red-500 font-bold' : ''}>
          {s.latestSalinity ?? '—'}
        </span>
      ),
      align: 'right'
    },
    { key: 'updatedAt', header: 'Cập nhật', render: () => '09:00' },
    { key: 'status', header: 'Trạng thái', render: (s) => <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded">Hoạt động</span> },
  ];

  const mapMarkers = stationsList.map(s => {
    let color = '#22c55e';
    if (s.latestSalinity && s.latestSalinity >= 4) color = '#ef4444';
    else if (s.latestSalinity && s.latestSalinity >= 1) color = '#eab308';
    
    return {
      id: s.id,
      lat: s.latitude,
      lng: s.longitude,
      color,
      label: s.name,
    };
  });

  return (
    <DashboardLayout
      leftPanel={
        <div className="p-5 space-y-6">
          <h2 className="font-bold text-gray-800">Bộ lọc & tìm kiếm</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Tỉnh/Thành phố</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                <option>Tất cả tỉnh thành</option>
                {provinces.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Sông</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                <option>Tất cả sông</option>
                {rivers.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Loại trạm</label>
              <div className="space-y-2">
                {['Độ mặn (‰)', 'Mực nước (m)', 'Lưu lượng (m³/s)', 'Thời tiết'].map((opt, i) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-500 focus:ring-blue-500" defaultChecked={i === 0 || i === 1} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors mt-6 text-sm">
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      }
      centerContent={
        <div className="h-full bg-white p-5 flex flex-col gap-4 overflow-hidden">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-bold text-lg text-gray-800">Danh sách trạm quan trắc</h2>
              <p className="text-xs text-gray-500">Hiển thị {stationsList.length} trạm quan trắc</p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm tên trạm, sông..." 
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm w-64 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <DataTable
              data={currentData}
              columns={columns}
              keyExtractor={(s) => s.id}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalElements={stationsList.length}
            />
          </div>
        </div>
      }
      rightPanel={
        <div className="h-full flex flex-col bg-white overflow-hidden border-l border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800 text-sm">Vị trí các trạm quan trắc</h3>
          </div>
          <div className="flex-1 relative">
            <MiniMap markers={mapMarkers} height="100%" />
            {/* Legend Map overlay */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow border border-gray-100 z-[1000] text-xs">
              <div className="font-semibold text-gray-700 mb-2">Độ mặn (‰)</div>
              <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> {'>'} 4.0</div>
              <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded-full bg-orange-400"></span> 2.0 - 4.0</div>
              <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> 1.0 - 2.0</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> {'<'} 1.0</div>
            </div>
          </div>
        </div>
      }
    />
  );
}
