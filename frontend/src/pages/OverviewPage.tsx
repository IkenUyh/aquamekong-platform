import React from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Radio, Database, ShieldAlert, Sparkles, CheckCircle, Layers, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { stationApi } from '../api/client';
import { recommendationApi } from '../api/recommendationApi';
import { useUnresolvedAlerts } from '../hooks/useAlerts';
import { formatNumber, isReporting, SALINITY_THRESHOLD } from '../utils/salinity';
import { StationsMiniMap } from '../components/shared/StationsMiniMap';
import { Link } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';

export function OverviewPage() {
  const { data: stations = [] } = useQuery({
    queryKey: ['stations', 'list'],
    queryFn: stationApi.getAllList,
  });

  const { data: openAlerts = [] } = useUnresolvedAlerts();

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: recommendationApi.getRecommendations,
  });

  const activeStationsCount = stations.filter((s) => s.status === 'ACTIVE').length;
  // "Đang truyền dữ liệu" = có số đo trong 2 giờ qua (trước đây chỉ đếm trạng thái ACTIVE trong danh mục)
  const reportingCount = stations.filter((s) => isReporting(s.lastMeasuredAt)).length;
  // Số TRẠM có độ mặn mới nhất vượt ngưỡng (trước đây đếm nhầm số cảnh báo CRITICAL)
  const stationsAboveThreshold = stations.filter((s) => (s.latestSalinity ?? 0) > SALINITY_THRESHOLD).length;

  return (
    <DashboardLayout
      leftPanel={
        <div className="p-5 space-y-6">
          <div>
            <h2 className="font-bold text-gray-800 text-lg mb-1">AquaMekong System</h2>
            <p className="text-xs text-gray-500">Giám sát & Dự báo Thủy văn ĐBSCL</p>
          </div>

          <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-600" /> Tình trạng hệ thống
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Số trạm hiện có:</span>
                <span className="font-bold text-gray-800">{stations.length} trạm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trạm đang hoạt động:</span>
                <span className="font-bold text-green-600">{activeStationsCount} trạm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cảnh báo đang mở:</span>
                <span className="font-bold text-red-600">{openAlerts.length} cảnh báo</span>
              </div>
            </div>
          </div>
        </div>
      }
      centerContent={
        <div className="h-full bg-gray-50 p-6 overflow-y-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-gray-800">Tổng quan Hệ thống Quan trắc</h1>
            <p className="text-xs text-gray-500 mt-1">
              Số liệu quan trắc mới nhất và khuyến nghị vận hành theo ngưỡng độ mặn
            </p>
          </div>

          {/* Top Metric Cards */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              title="Tổng số trạm quan trắc"
              value={stations.length}
              unit="trạm"
              icon={<Radio className="w-5 h-5 text-blue-600" />}
              color="text-blue-600"
              subtitle="Đang quản lý trên hệ thống"
            />
            <MetricCard
              title="Trạm đang truyền dữ liệu"
              value={reportingCount}
              unit={`/ ${activeStationsCount} trạm`}
              icon={<CheckCircle className="w-5 h-5 text-green-600" />}
              color="text-green-600"
              subtitle="Có số đo trong 2 giờ qua"
            />
            <MetricCard
              title="Trạm cảnh báo mặn"
              value={stationsAboveThreshold}
              unit="trạm"
              icon={<ShieldAlert className="w-5 h-5 text-red-500" />}
              color="text-red-500"
              subtitle={`Vượt ngưỡng ${SALINITY_THRESHOLD}‰`}
            />
            <MetricCard
              title="Khuyến nghị"
              value={recommendations.length}
              unit="gợi ý"
              icon={<Sparkles className="w-5 h-5 text-amber-500" />}
              color="text-amber-600"
              subtitle="Theo độ mặn hiện tại"
            />
          </div>

          {/* Recommendations List */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Khuyến nghị vận hành
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {recommendations.length > 0 ? (
                recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 bg-amber-50/60 rounded-lg border border-amber-100 flex items-start gap-3">
                    <span className="text-xl">{rec.icon || '💡'}</span>
                    <div>
                      <p className="text-xs font-bold text-amber-900">{rec.priority === 'HIGH' ? 'Ưu tiên cao' : 'Khuyến nghị'}</p>
                      <p className="text-xs text-amber-800 mt-0.5">{rec.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-xs text-gray-400 italic">Đang cập nhật khuyến nghị...</div>
              )}
            </div>
          </div>

          {/* Stations Quick View Table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              Trạm có độ mặn cao nhất
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2">Mã trạm</th>
                    <th className="px-3 py-2">Tên trạm</th>
                    <th className="px-3 py-2">Tỉnh/Thành</th>
                    <th className="px-3 py-2">Sông</th>
                    <th className="px-3 py-2 text-right">Độ mặn (‰)</th>
                    <th className="px-3 py-2 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...stations]
                    .sort((a, b) => (b.latestSalinity ?? -1) - (a.latestSalinity ?? -1))
                    .slice(0, 8)
                    .map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-bold text-blue-600">{s.code}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{s.name}</td>
                      <td className="px-3 py-2 text-gray-600">{s.province}</td>
                      <td className="px-3 py-2 text-gray-600">{s.riverName || 'N/A'}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${(s.latestSalinity ?? 0) > SALINITY_THRESHOLD ? 'text-red-500' : 'text-gray-700'}`}>
                        {formatNumber(s.latestSalinity)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.status === 'INACTIVE' ? (
                          <span className="bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full border border-gray-200">Ngừng hoạt động</span>
                        ) : isReporting(s.lastMeasuredAt) ? (
                          <span className="bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full border border-green-200">Đang truyền</span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-200">Mất tín hiệu</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
      rightPanel={
        <div className="p-4 space-y-4">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-500" />
            Bản đồ rút gọn
          </h3>
          <div className="h-[420px]">
            <StationsMiniMap
              stations={stations.map((s) => ({ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude, salinity: s.latestSalinity }))}
            />
          </div>
          <Link to="/map" className="block text-center text-xs font-medium text-blue-600 hover:underline">
            Mở bản đồ độ mặn chi tiết &gt;
          </Link>
        </div>
      }
    />
  );
}
