import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Navbar } from '../components/Navbar';
import { MetricCard } from '../components/MetricCard';
import { RecommendationList } from '../components/RecommendationList';
import { StationsMiniMap } from '../components/shared/StationsMiniMap';
import { useStationsList } from '../hooks/useStations';
import { useUnresolvedAlerts } from '../hooks/useAlerts';
import { recommendationApi } from '../api/recommendationApi';
import { percentChange, reportApi } from '../api/reportApi';
import type { Station } from '../types';
import {
  classifySalinity, formatNumber, isReporting, ONLINE_WINDOW_HOURS, SALINITY_CLASS_COLORS, SALINITY_THRESHOLD,
} from '../utils/salinity';

/** Thang của thanh ngang: 2 × ngưỡng, để vạch ngưỡng nằm giữa */
const BAR_MAX = SALINITY_THRESHOLD * 2;

function SalinityBar({ value }: { value: number | null | undefined }) {
  const pct = value == null ? 0 : Math.min(value / BAR_MAX, 1) * 100;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-gray-100" aria-hidden="true">
      <div className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${pct}%`, backgroundColor: SALINITY_CLASS_COLORS[classifySalinity(value)] }} />
      {/* vạch ngưỡng */}
      <div className="absolute -top-1 -bottom-1 w-px bg-gray-400" style={{ left: `${(SALINITY_THRESHOLD / BAR_MAX) * 100}%` }} />
    </div>
  );
}

function StationRanking({ stations }: { stations: Station[] }) {
  const sorted = [...stations].sort((a, b) => (b.latestSalinity ?? -1) - (a.latestSalinity ?? -1));
  return (
    <ul className="divide-y divide-gray-100">
      {sorted.map((s) => {
        const above = (s.latestSalinity ?? 0) > SALINITY_THRESHOLD;
        return (
          <li key={s.id} className="py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-gray-900 truncate">
                {s.name}
                {!isReporting(s.lastMeasuredAt) && <span className="ml-1.5 text-xs text-amber-700">· mất tín hiệu</span>}
              </span>
              <span className={`text-sm num font-semibold ${above ? 'text-red-600' : 'text-gray-900'}`}>
                {formatNumber(s.latestSalinity)}<span className="ml-0.5 text-xs font-normal text-gray-500">‰</span>
              </span>
            </div>
            <div className="mt-1.5"><SalinityBar value={s.latestSalinity} /></div>
          </li>
        );
      })}
    </ul>
  );
}

export function OverviewPage() {
  const { data: stations = [] } = useStationsList();
  const { data: openAlerts = [] } = useUnresolvedAlerts();
  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: recommendationApi.getRecommendations,
  });
  const { data: last24h } = useQuery({ queryKey: ['reports', 'overview', 1], queryFn: () => reportApi.getOverview(1) });
  const { data: trend = [] } = useQuery({ queryKey: ['reports', 'trend', 7], queryFn: () => reportApi.getTrend(7) });

  const aboveThreshold = stations.filter((s) => (s.latestSalinity ?? 0) > SALINITY_THRESHOLD).length;
  const activeCount = stations.filter((s) => s.status === 'ACTIVE').length;
  const reportingCount = stations.filter((s) => isReporting(s.lastMeasuredAt)).length;
  const lastUpdate = stations
    .map((s) => s.lastMeasuredAt)
    .filter((t): t is string => !!t)
    .sort()
    .pop();
  const salinityChange = last24h ? percentChange(last24h.avgSalinity) : null;

  const trendData = trend.map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
  }));
  const hasTrend = trendData.some((p) => p.current != null);

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full p-4 lg:p-6 space-y-6">
          {/* Tiêu đề */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Tổng quan</h1>
            <p className="text-sm text-gray-500 num">
              {lastUpdate
                ? `Số đo mới nhất lúc ${new Date(lastUpdate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`
                : 'Chưa có số đo'}
            </p>
          </div>

          {/* Chỉ số chính */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              label={`Trạm vượt ngưỡng ${SALINITY_THRESHOLD}‰`}
              value={`${aboveThreshold} / ${stations.length}`}
              tone={aboveThreshold > 0 ? 'danger' : 'default'}
              hint="theo số đo mới nhất"
            />
            <MetricCard
              label="Độ mặn trung bình 24 giờ"
              value={formatNumber(last24h?.avgSalinity.current)}
              unit="‰"
              change={salinityChange != null ? { value: salinityChange, kind: '%', label: 'so với 24h trước', upIsBad: true } : undefined}
            />
            <MetricCard
              label="Trạm đang truyền dữ liệu"
              value={`${reportingCount} / ${activeCount}`}
              hint={`có số đo trong ${ONLINE_WINDOW_HOURS} giờ qua`}
            />
            <MetricCard
              label="Cảnh báo chưa xử lý"
              value={openAlerts.length}
              tone={openAlerts.length > 0 ? 'danger' : 'default'}
              hint={openAlerts.length > 0 ? undefined : 'không có cảnh báo mở'}
            />
          </div>

          {/* Bản đồ + xếp hạng trạm */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="card overflow-hidden lg:col-span-2 flex flex-col">
              <div className="flex items-baseline justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Độ mặn tại các trạm</h2>
                <Link to="/map" className="text-xs font-medium text-primary hover:underline">Mở bản đồ chi tiết</Link>
              </div>
              <div className="h-[420px]">
                <StationsMiniMap
                  stations={stations.map((s) => ({ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude, salinity: s.latestSalinity }))}
                />
              </div>
            </section>

            <section className="card p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Xếp hạng theo độ mặn</h2>
                <span className="text-xs text-gray-500">vạch = ngưỡng {SALINITY_THRESHOLD}‰</span>
              </div>
              {stations.length === 0
                ? <p className="mt-3 text-sm text-gray-500">Chưa có trạm.</p>
                : <StationRanking stations={stations} />}
            </section>
          </div>

          {/* Xu hướng + khuyến nghị */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="card p-4 lg:col-span-2">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Độ mặn trung bình toàn vùng, 7 ngày</h2>
                <Link to="/reports" className="text-xs font-medium text-primary hover:underline">Xem báo cáo</Link>
              </div>
              <div className="h-[220px]">
                {hasTrend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => [`${formatNumber(v)}‰`, 'Độ mặn TB']} />
                      <ReferenceLine y={SALINITY_THRESHOLD} stroke="#ef4444" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="current" stroke="#0F3D5E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-500">Chưa đủ dữ liệu 7 ngày</div>
                )}
              </div>
            </section>

            <section className="card p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Khuyến nghị vận hành</h2>
              <RecommendationList items={recommendations} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
