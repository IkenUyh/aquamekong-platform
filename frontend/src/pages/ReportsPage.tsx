import React from 'react';
import { Navbar } from '../components/Navbar';
import { MetricCard } from '../components/MetricCard';
import { DonutChart } from '../components/shared/DonutChart';
import { DataTable, Column } from '../components/shared/DataTable';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { FileText, Droplets, AlertTriangle, CloudRain, Waves } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../api/reportApi';
import { stationApi } from '../api/client';
import apiClient from '../api/client';
import { useMemo } from 'react';

export function ReportsPage() {
  const { data: trendData = [] } = useQuery({
    queryKey: ['reports', 'trend'],
    queryFn: reportApi.getTrendData,
  });

  const { data: topStations = [] } = useQuery({
    queryKey: ['reports', 'topStations'],
    queryFn: reportApi.getTopStations,
  });

  const { data: stations = [] } = useQuery({
    queryKey: ['stations', 'list'],
    queryFn: stationApi.getAllList,
  });

  const { data: summary } = useQuery({
    queryKey: ['metrics', 'summary'],
    queryFn: () => apiClient.get('/metrics/summary').then(r => r.data),
  });

  const avgSalinity = useMemo(() => {
    if (!stations.length) return 0;
    const sum = stations.reduce((acc, s) => acc + (s.latestSalinity || 0), 0);
    return (sum / stations.length).toFixed(1);
  }, [stations]);

  const stationsOverThreshold = useMemo(() => {
    return stations.filter(s => (s.latestSalinity || 0) > 4).length;
  }, [stations]);

  const stationsByLevel = useMemo(() => {
    const critical = stations.filter(s => s.salinityLevel === 'HIGH').length;
    const warning = stations.filter(s => s.salinityLevel === 'MEDIUM').length;
    const safe = stations.filter(s => s.salinityLevel === 'LOW').length;
    
    // For Donut chart percentages, just use percentages or raw counts? 
    // The previous hardcode had 17, 25, 28, 30. Let's calculate percentage.
    const total = stations.length || 1; // prevent div by zero
    
    return {
      critical, warning, safe, total,
      criticalPct: Math.round((critical / total) * 100),
      warningPct: Math.round((warning / total) * 100),
      safePct: Math.round((safe / total) * 100),
    };
  }, [stations]);


  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <Navbar />
      
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Báo cáo tổng quan</h1>
            </div>
            <p className="text-sm text-gray-500 ml-11">Tổng hợp tình hình độ mặn và các chỉ số quan trọng trong khu vực</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-600">Loại báo cáo:</span>
            <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 font-medium">
              <option>Tổng quan</option>
              <option>Dữ liệu trạm</option>
              <option>Cảnh báo</option>
            </select>
            <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 font-medium">
              <option>Tuần này</option>
              <option>Tháng này</option>
            </select>
          </div>
        </div>

        {/* Row 1: Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard title="Trung bình độ mặn toàn vùng" value={avgSalinity.toString()} unit="‰" icon="💧"
            trend={{ value: 12, isPositive: false }}
            highlightColor="text-blue-600" />
          <MetricCard title="Trạm vượt ngưỡng 4‰" value={`${stationsOverThreshold}/${stations.length}`} unit="" icon="⚠️"
            trend={{ value: 1, isPositive: true }} // 1 trạm mới
            highlightColor="text-red-500" />
          <MetricCard title="Lượng mưa trung bình" value={summary?.rainfall?.toFixed(1) || '—'} unit="mm" icon="🌧️"
            trend={{ value: summary?.rainfallDeltaPercent || 0, isPositive: (summary?.rainfallDeltaPercent || 0) >= 0 }}
            highlightColor="text-blue-400" />
          <MetricCard title="Lưu lượng trung bình" value={summary?.flowRate?.toLocaleString() || '—'} unit="m³/s" icon="🌊"
            trend={{ value: summary?.flowRateDeltaPercent || 0, isPositive: (summary?.flowRateDeltaPercent || 0) >= 0 }}
            highlightColor="text-teal-500" />
        </div>

        {/* Row 2: Charts */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800">Xu hướng độ mặn theo thời gian</h3>
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-full"/> Trung bình toàn vùng</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-300 rounded-full"/> Tuần trước</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-1 border-b-2 border-red-500 border-dashed"/> Ngưỡng 4‰</span>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="prev" stroke="#cbd5e1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="current" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col">
            <h3 className="font-bold text-gray-800 mb-6">Tỷ lệ trạm theo mức độ</h3>
            <div className="flex-1">
              <DonutChart 
                data={[
                  { name: 'Nguy hiểm', value: stationsByLevel.critical, color: '#ef4444' },
                  { name: 'Cảnh báo', value: stationsByLevel.warning, color: '#eab308' },
                  { name: 'Bình thường', value: stationsByLevel.safe, color: '#22c55e' },
                ]}
                totalLabel="Trạm"
                totalValue={stationsByLevel.total}
              />
            </div>
            <div className="grid grid-cols-2 gap-y-3 mt-6 text-sm">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Nguy hiểm</span> <span className="font-bold text-gray-700">{stationsByLevel.criticalPct}%</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400" /> Cảnh báo</span> <span className="font-bold text-gray-700">{stationsByLevel.warningPct}%</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /> Bình thường</span> <span className="font-bold text-gray-700">{stationsByLevel.safePct}%</span></div>
            </div>
          </div>
        </div>

        {/* Row 3: Top Stations Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">Top 5 trạm có độ mặn cao nhất</h3>
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Tên trạm</th>
                  <th className="px-4 py-3">Tỉnh/Thành</th>
                  <th className="px-4 py-3">Độ mặn (‰)</th>
                  <th className="px-4 py-3 text-right">So với tuần trước</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {topStations.map((s: any) => (
                  <tr key={s.rank} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400">{s.rank}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                    <td className="px-4 py-3">{s.province}</td>
                    <td className="px-4 py-3 font-bold text-red-500">{s.salinity}</td>
                    <td className="px-4 py-3 text-right text-red-500 text-xs font-bold bg-red-50/50 inline-block mt-2 rounded">{s.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
