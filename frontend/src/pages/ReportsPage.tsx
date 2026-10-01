import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { MetricCard } from '../components/MetricCard';
import { DonutChart } from '../components/shared/DonutChart';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { reportApi, percentChange, type PeriodValue, type ReportOverview } from '../api/reportApi';

const PERIODS = [
  { days: 7, label: '7 ngày qua' },
  { days: 30, label: '30 ngày qua' },
  { days: 90, label: '90 ngày qua' },
];

const LEVEL_COLORS: Record<ReportOverview['levelDistribution'][number]['level'], string> = {
  HIGH: '#ef4444',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  UNKNOWN: '#cbd5e1',
};

const fmt = (v: number | null | undefined, digits = 2) =>
  v == null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: digits });

/** trend cho MetricCard: isPositive = tăng (MetricCard tô đỏ khi tăng) */
function trendOf(v: PeriodValue | undefined) {
  const pct = v ? percentChange(v) : null;
  return pct == null ? undefined : { value: Math.abs(pct), isPositive: pct > 0 };
}

export function ReportsPage() {
  const [days, setDays] = useState(7);

  const { data: overview } = useQuery({
    queryKey: ['reports', 'overview', days],
    queryFn: () => reportApi.getOverview(days),
  });

  const { data: trendData = [] } = useQuery({
    queryKey: ['reports', 'trend', days],
    queryFn: () => reportApi.getTrend(days),
  });

  const { data: topStations = [] } = useQuery({
    queryKey: ['reports', 'topStations', days],
    queryFn: () => reportApi.getTopStations(days),
  });

  const chartData = trendData.map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
  }));
  const distribution = overview?.levelDistribution ?? [];
  const totalStations = overview?.totalStations ?? 0;
  const percentOf = (count: number) => (totalStations > 0 ? Math.round((count / totalStations) * 100) : 0);

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
            <p className="text-sm text-gray-500 ml-11">
              Tổng hợp tình hình độ mặn và các chỉ số quan trọng, so với {days} ngày liền trước
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-600">Kỳ báo cáo:</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 font-medium"
            >
              {PERIODS.map((p) => (
                <option key={p.days} value={p.days}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 1: Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard title="Trung bình độ mặn toàn vùng" value={fmt(overview?.avgSalinity.current)} unit="‰" icon="💧"
            trend={trendOf(overview?.avgSalinity)}
            highlightColor="text-blue-600" />
          <MetricCard title={`Trạm vượt ngưỡng ${overview?.salinityThreshold ?? 4}‰`}
            value={overview ? `${overview.stationsAboveThreshold}/${overview.totalStations}` : '—'} unit="" icon="⚠️"
            highlightColor="text-red-500" />
          <MetricCard title="Mực nước trung bình" value={fmt(overview?.avgWaterLevel.current)} unit="m" icon="📏"
            trend={trendOf(overview?.avgWaterLevel)}
            highlightColor="text-indigo-500" />
          <MetricCard title="Lưu lượng trung bình" value={fmt(overview?.avgFlowRate.current, 0)} unit="m³/s" icon="🌊"
            trend={trendOf(overview?.avgFlowRate)}
            highlightColor="text-teal-500" />
        </div>

        {/* Row 2: Charts */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800">Xu hướng độ mặn theo thời gian</h3>
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-full"/> Trung bình toàn vùng</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-300 rounded-full"/> Kỳ trước</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-1 border-b-2 border-red-500 border-dashed"/> Ngưỡng 4‰</span>
              </div>
            </div>
            <div className="h-[250px] w-full">
              {chartData.every((p) => p.current == null && p.previous == null) ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">Chưa có dữ liệu độ mặn trong kỳ</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <ReferenceLine y={overview?.salinityThreshold ?? 4} stroke="#ef4444" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="previous" name="Kỳ trước" stroke="#cbd5e1" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="current" name="Kỳ này" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col">
            <h3 className="font-bold text-gray-800 mb-6">Tỷ lệ trạm theo mức độ mặn</h3>
            <div className="flex-1">
              <DonutChart
                data={distribution.map((d) => ({ name: d.label, value: d.count, color: LEVEL_COLORS[d.level] }))}
                totalLabel="Trạm"
                totalValue={totalStations}
              />
            </div>
            <div className="grid grid-cols-1 gap-y-2 mt-6 text-sm">
              {distribution.map((d) => (
                <div key={d.level} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS[d.level] }} /> {d.label}
                  </span>
                  <span className="font-bold text-gray-700">{d.count} ({percentOf(d.count)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Top Stations Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">Top {topStations.length || 5} trạm có độ mặn trung bình cao nhất</h3>
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Tên trạm</th>
                  <th className="px-4 py-3">Tỉnh/Thành</th>
                  <th className="px-4 py-3">Độ mặn TB (‰)</th>
                  <th className="px-4 py-3 text-right">So với kỳ trước</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {topStations.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chưa có dữ liệu độ mặn trong kỳ</td></tr>
                )}
                {topStations.map((s) => (
                  <tr key={s.stationId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400">{s.rank}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                    <td className="px-4 py-3">{s.province || '—'}</td>
                    <td className={`px-4 py-3 font-bold ${(s.salinity ?? 0) > (overview?.salinityThreshold ?? 4) ? 'text-red-500' : 'text-gray-800'}`}>
                      {fmt(s.salinity)}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-bold ${s.diff == null ? 'text-gray-400' : s.diff > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {s.diff == null ? '—' : `${s.diff > 0 ? '+' : ''}${fmt(s.diff)}‰`}
                    </td>
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
