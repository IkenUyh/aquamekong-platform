import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ForecastSummaryPanel } from '../components/ForecastSummaryPanel';
import { ForecastChart } from '../components/ForecastChart';
import { MiniMap } from '../components/shared/MiniMap';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Search, Info } from 'lucide-react';
import type { SalinityForecast, Station } from '../types';
import { useQuery } from '@tanstack/react-query';
import { stationApi } from '../api/client';
import { generateMockForecasts } from '../data/mockData';

export function ForecastPage() {
  const { data: stations = [] } = useQuery({
    queryKey: ['stations', 'list'],
    queryFn: stationApi.getAllList,
  });

  const [selectedStations, setSelectedStations] = useState<number[]>([1, 2, 3, 5, 6]);



  return (
    <DashboardLayout
      leftPanel={
        <div className="p-5 space-y-6">
          <h2 className="font-bold text-gray-800">Bộ lọc dự báo</h2>
          
          <div className="space-y-4 border-b border-gray-100 pb-6">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Thời gian dự báo</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                <option>3 - 7 ngày</option>
                <option>14 ngày</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Tỉnh/Thành phố</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                <option>Tất cả</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Trạm quan tâm</label>
              <div className="space-y-2 mb-3">
                {stations.slice(0, 10).map((s) => (
                  <label key={s.id} className="flex items-center justify-between text-sm text-gray-700 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500" 
                        checked={selectedStations.includes(s.id)}
                        onChange={() => {
                          if (selectedStations.includes(s.id)) setSelectedStations(prev => prev.filter(id => id !== s.id));
                          else setSelectedStations(prev => [...prev, s.id]);
                        }}
                      />
                      {s.name}
                    </div>
                  </label>
                ))}
              </div>
              <button className="text-blue-500 text-sm font-medium flex items-center gap-1 hover:underline">
                + Thêm trạm
              </button>
            </div>

            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors mt-2 text-sm shadow-sm shadow-blue-500/30">
              Xem dự báo
            </button>
          </div>

          <div>
            <h3 className="font-bold text-gray-800 mb-3 text-sm">Hiển thị</h3>
            <div className="space-y-3">
              {[
                { label: 'Độ mặn (‰)', checked: true },
                { label: 'Mực nước (m)', checked: false },
                { label: 'Lưu lượng (m³/s)', checked: false },
                { label: 'Biểu đồ', checked: true },
              ].map(t => (
                <div key={t.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t.label}</span>
                  <div className={`w-8 h-4 rounded-full relative cursor-pointer ${t.checked ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${t.checked ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
      centerContent={
        <div className="h-full flex">
          {/* Grid Section (50%) */}
          <div className="flex-1 p-5 overflow-y-auto bg-gray-50 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-bold text-lg text-gray-800">Dự báo độ mặn 3 - 7 ngày</h2>
              <p className="text-xs text-gray-500">Dự báo tại các trạm quan trọng tâm</p>
            </div>

            {/* Date timeline */}
            <div className="flex gap-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
              {['T2', 'T3', 'T4', 'T5', 'T6'].map((day, i) => (
                <div key={day} className={`flex-1 text-center py-2 rounded-lg ${i===0 ? 'bg-blue-50 border border-blue-200' : ''}`}>
                  <p className={`text-xs font-bold ${i===0 ? 'text-blue-600' : 'text-gray-500'}`}>{day}</p>
                  <p className={`text-[10px] ${i===0 ? 'text-blue-400' : 'text-gray-400'}`}>19/05</p>
                </div>
              ))}
            </div>

            {/* Grid of charts */}
            <div className="grid grid-cols-2 gap-4">
              {stations.filter(s => selectedStations.includes(s.id)).map(s => {
                const currentSalinity = s.latestSalinity || 0;
                const isHigh = currentSalinity >= 4;
                const trend = s.salinityLevel === 'CRITICAL' ? 'high' : s.salinityLevel === 'WARNING' ? 'rising' : 'stable';
                
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800 flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${isHigh ? 'bg-red-500' : 'bg-blue-500'}`} />
                          {s.name}
                        </h4>
                        <p className="text-xs text-gray-500">{s.riverName || 'N/A'}</p>
                        <p className="text-lg font-bold mt-1 text-gray-800">
                          {currentSalinity}‰ <span className="text-xs font-normal text-gray-400">hiện tại</span>
                        </p>
                      </div>
                      <StatusBadge level={isHigh ? 'CRITICAL' : currentSalinity >= 2 ? 'WARNING' : 'SAFE'} />
                    </div>
                    <div className="h-[120px] -mx-2">
                      <ForecastChart forecasts={generateMockForecasts(currentSalinity)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Map Section (50%) */}
          <div className="flex-1 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Bản đồ dự báo độ mặn (ngày 21/05)</h3>
            </div>
            <div className="flex-1 relative">
               <MiniMap 
                 markers={[
                   { id: 1, lat: 10.0, lng: 105.7, color: '#3b82f6', label: 'Cần Thơ: 2.1‰' },
                   { id: 2, lat: 10.25, lng: 106.4, color: '#ef4444', label: 'Gò Công: 6.1‰' }
                 ]} 
                 height="100%" 
               />
               
               <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-xl p-4 shadow-lg border border-gray-200 z-[1000]">
                 <h4 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2">
                   <Info className="w-4 h-4 text-blue-500" /> Nhận xét chung
                 </h4>
                 <ul className="text-xs text-gray-600 space-y-1 pl-4 list-disc marker:text-blue-500">
                   <li>Độ mặn có xu hướng tăng vào các ngày giữa tuần, đặc biệt tại khu vực ven biển.</li>
                   <li>Cần chú ý trạm Gò Công và Trà Vinh có khả năng vượt ngưỡng 4‰.</li>
                 </ul>
               </div>
            </div>
          </div>
        </div>
      }
      rightPanel={<></>}
    />
  );
}
