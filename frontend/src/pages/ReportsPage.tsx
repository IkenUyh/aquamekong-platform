import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { BottomNav } from '../components/BottomNav';
import { MetricCard, type MetricChange } from '../components/MetricCard';
import { DonutChart } from '../components/shared/DonutChart';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { reportApi, percentChange, type PeriodValue } from '../api/reportApi';
import { formatNumber, SALINITY_CLASS_COLORS } from '../utils/salinity';
import { roundedPercents } from '../utils/percent';

const PERIODS = [
  { days: 7, label: '7 ngày qua' },
  { days: 30, label: '30 ngày qua' },
  { days: 90, label: '90 ngày qua' },
];


/** Chỉ số trung bình: luôn đủ chữ số thập phân */
const fmt = (value: number | null | undefined, digits = 2) => formatNumber(value, digits, true);

/** % thay đổi so với kỳ trước cho MetricCard (độ mặn: tăng là xấu) */
function changeOf(v: PeriodValue | undefined, upIsBad = false): MetricChange | undefined {
  const pct = v ? percentChange(v) : null;
  return pct == null ? undefined : { value: pct, kind: '%', label: 'so với kỳ trước', upIsBad };
}
export function ReportsPage() {
  const [days, setDays] = useState(7);

  const { data: overview } = useQuery({
    queryKey: ['reports', 'overview', days],
    queryFn: () => reportApi.getOverview(days),
  });

  const hasFlow = overview?.avgFlowRate.current != null || overview?.avgFlowRate.previous != null;
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
  const percents = roundedPercents(distribution.map((d) => d.count));

  return (
    <div className="flex flex-col h-dvh w-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <Navbar />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Báo cáo</h1>
            <p className="text-sm text-gray-500 mt-1">
              Tổng hợp tình hình độ mặn và các chỉ số quan trọng, so với {days} ngày liền trước
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-600">Kỳ báo cáo:</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="field w-auto"
            >
              {PERIODS.map((p) => (
                <option key={p.days} value={p.days}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 1: Metrics */}
        <div className={`grid grid-cols-2 ${hasFlow ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-6`}>
          <MetricCard label="Độ mặn trung bình toàn vùng" value={fmt(overview?.avgSalinity.current)} unit="‰"
            change={changeOf(overview?.avgSalinity, true)} />
          <MetricCard label={`Trạm vượt ngưỡng ${overview?.salinityThreshold ?? 4}‰`}
            value={overview ? `${overview.stationsAboveThreshold} / ${overview.totalStations}` : '—'}
            tone={(overview?.stationsAboveThreshold ?? 0) > 0 ? 'danger' : 'default'} hint="theo số đo mới nhất" />
          <MetricCard label="Mực nước trung bình" value={fmt(overview?.avgWaterLevel.current)} unit="m"
            change={changeOf(overview?.avgWaterLevel)} />
          {/* Dữ liệu RYNAN không đo lưu lượng: ô luôn trống thì ẩn */}
          {hasFlow && (
            <MetricCard label="Lưu lượng trung bình" value={fmt(overview?.avgFlowRate.current, 0)} unit="m³/s"
              change={changeOf(overview?.avgFlowRate)} />
          )}
        </div>

        {/* Row 2: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 card p-5">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
              <h3 className="font-semibold text-gray-900">Xu hướng độ mặn theo thời gian</h3>
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-primary rounded-full"/> Trung bình toàn vùng</span>
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
                    <Line type="monotone" dataKey="current" name="Kỳ này" stroke="#0F3D5E" strokeWidth={3} activeDot={{ r: 6 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card p-5 flex flex-col">
            <h3 className="font-semibold text-gray-900 mb-6">Tỷ lệ trạm theo mức độ mặn</h3>
            <div className="flex-1">
              <DonutChart
                data={distribution.map((d) => ({ name: d.label, value: d.count, color: SALINITY_CLASS_COLORS[d.level] }))}
                totalLabel="Trạm"
                totalValue={totalStations}
              />
            </div>
            <div className="grid grid-cols-1 gap-y-2 mt-6 text-sm">
              {distribution.map((d, i) => (
                <div key={d.level} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SALINITY_CLASS_COLORS[d.level] }} /> {d.label}
                  </span>
                  <span className="font-bold text-gray-700">{d.count} ({percents[i]}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Top Stations Table */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top {topStations.length || 5} trạm có độ mặn trung bình cao nhất</h3>
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
      <BottomNav />
    </div>
  );
}
