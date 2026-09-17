import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DataTable, Column } from '../components/shared/DataTable';
import { StatusBadge, StatusLevel } from '../components/shared/StatusBadge';
import { SummaryCounter } from '../components/shared/SummaryCounter';
import { AlertTriangle, AlertCircle, Info, Settings, TrendingUp } from 'lucide-react';
import type { AlertDto } from '../types/alert';
import { HistoryChart } from '../components/HistoryChart';
import { useQuery } from '@tanstack/react-query';
import { alertApi } from '../api/alertApi';
import { metricApi } from '../api/client';
import apiClient from '../api/client';

export function AlertsPage() {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', 'recent'],
    queryFn: alertApi.getRecent,
    refetchInterval: 30000,
  });

  const [selectedAlert, setSelectedAlert] = useState<AlertDto | null>(null);
  const [page, setPage] = useState(1);

  // Auto select first alert if not selected and data is loaded
  React.useEffect(() => {
    if (alerts.length > 0 && !selectedAlert) {
      setSelectedAlert(alerts[0]);
    }
  }, [alerts, selectedAlert]);

  const { data: counts = { CRITICAL: 0, WARNING: 0, INFO: 0 } } = useQuery({
    queryKey: ['alerts', 'counts'],
    queryFn: alertApi.getCountBySeverity,
    refetchInterval: 30000,
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => apiClient.get('/recommendations').then(r => r.data),
    enabled: !!selectedAlert,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['metrics', selectedAlert?.stationId],
    queryFn: () => metricApi.getByStation(selectedAlert!.stationId),
    enabled: !!selectedAlert,
  });

  const columns: Column<AlertDto>[] = [
    { key: 'severity', header: 'Mức độ', render: (a) => <StatusBadge level={a.severity as StatusLevel || 'INFO'} /> },
    { key: 'station', header: 'Trạm', render: (a) => <span className="font-semibold text-gray-800">{a.stationName?.split(' ')[0] || `Trạm ${a.stationId}`}</span> },
    { key: 'province', header: 'Tỉnh/Thành', render: (a) => a.province || '—' },
    { key: 'salinity', header: 'Độ mặn (‰)', render: (a) => <span className="font-bold" style={{ color: a.severity === 'CRITICAL' ? '#ef4444' : a.severity === 'WARNING' ? '#eab308' : '#22c55e' }}>{'>'} {a.actualValue?.toFixed(1) || 0}</span> },
    { key: 'time', header: 'Thời gian', render: (a) => new Date(a.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' ' + new Date(a.createdAt).toLocaleDateString('vi-VN') },
    { key: 'status', header: 'Trạng thái', render: (a) => a.message },
  ];

  if (isLoading) return <div>Loading...</div>;

  return (
    <DashboardLayout
      leftPanel={
        <div className="p-5 space-y-6">
          <h2 className="font-bold text-gray-800">Bộ lọc cảnh báo</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Thời gian</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                <option>Trong 7 ngày</option>
                <option>Trong 24 giờ</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Mức độ</label>
              <div className="space-y-2">
                {['Nguy hiểm', 'Cảnh báo', 'Theo dõi'].map((opt, i) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-500 focus:ring-blue-500" defaultChecked />
                    <span className={`w-3 h-3 rounded-full ${i===0 ? 'bg-red-500' : i===1 ? 'bg-yellow-400' : 'bg-green-400'}`}></span>
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Tỉnh/Thành phố</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                <option>Tất cả tỉnh thành</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Trạm</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                <option>Tất cả trạm</option>
              </select>
            </div>

            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors mt-6 text-sm">
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      }
      centerContent={
        <div className="h-full bg-white p-5 flex flex-col gap-4 overflow-hidden">
          <div>
            <h2 className="font-bold text-lg text-gray-800">Danh sách cảnh báo</h2>
            <p className="text-xs text-gray-500">Các trạm đang ở mức nguy hiểm hoặc có nguy cơ tăng độ mặn</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-2">
            <SummaryCounter count={counts.CRITICAL || 0} label="Trạm nguy hiểm" colorClass="text-red-500" icon={<AlertCircle className="w-5 h-5" />} />
            <SummaryCounter count={counts.WARNING || 0} label="Trạm cảnh báo" colorClass="text-yellow-500" icon={<AlertTriangle className="w-5 h-5" />} />
            <SummaryCounter count={counts.INFO || 0} label="Trạm theo dõi" colorClass="text-blue-500" icon={<Info className="w-5 h-5" />} />
          </div>
          
          <div className="flex-1 overflow-hidden mt-2">
            <DataTable
              data={alerts}
              columns={columns}
              keyExtractor={(a) => a.id}
              selectedRowKey={selectedAlert?.id}
              onRowClick={setSelectedAlert}
              page={page}
              totalPages={1}
              onPageChange={setPage}
              totalElements={alerts.length}
            />
          </div>
        </div>
      }
      rightPanel={
        selectedAlert ? (
          <div className="h-full flex flex-col space-y-4">
            <h2 className="font-bold text-lg text-gray-800 mb-2">Chi tiết cảnh báo</h2>
            
            <div className={`p-4 rounded-xl border ${selectedAlert.severity === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
              <div className="flex items-center gap-2 mb-1 font-bold">
                {selectedAlert.severity === 'CRITICAL' ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                {selectedAlert.severity === 'CRITICAL' ? 'Nguy hiểm' : 'Cảnh báo'}
              </div>
              <p className="text-sm opacity-80">{selectedAlert.stationName}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Độ mặn hiện tại</p>
                  <p className="text-3xl font-bold text-red-600">{selectedAlert.actualValue?.toFixed(1) || 0}‰</p>
                </div>
                <div className="text-right">
                  {/* delta removed as it requires historic metric querying for the specific alert time */}
                  <p className="text-[10px] text-gray-400">{new Date(selectedAlert.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </div>
              
              <div className="h-[200px] -mx-4">
                <HistoryChart 
                  metrics={metrics}
                  stationName={selectedAlert.stationName}
                  threshold={selectedAlert.thresholdValue}
                />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="font-bold text-sm text-gray-800 mb-2">Nguy cơ</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Vượt ngưỡng {selectedAlert.thresholdValue}‰. {selectedAlert.severity === 'CRITICAL' ? 'Có nguy cơ ảnh hưởng nghiêm trọng đến sản xuất nông nghiệp và cấp nước sinh hoạt.' : 'Cần theo dõi sát diễn biến độ mặn.'}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm bg-blue-50/30">
              <div className="flex items-center gap-2 text-blue-700 font-bold mb-3">
                <Settings className="w-5 h-5" />
                Khuyến nghị
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                {recommendations.length > 0 ? recommendations.map((rec: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    {rec.message}
                  </li>
                )) : (
                  <li className="flex items-start gap-2 text-gray-500 italic">Đang tải khuyến nghị...</li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Chọn một cảnh báo để xem chi tiết
          </div>
        )
      }
    />
  );
}
