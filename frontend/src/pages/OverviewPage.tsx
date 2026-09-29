import React from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Radio, Database, ShieldAlert, Sparkles, CheckCircle, AlertTriangle, Layers, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { stationApi, recommendationApi, metricApi } from '../api/client';
import { alertApi } from '../api/alertApi';
import { MetricCard } from '../components/MetricCard';

export function OverviewPage() {
  const { data: stations = [] } = useQuery({
    queryKey: ['stations', 'list'],
    queryFn: stationApi.getAllList,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['metrics', 'latest'],
    queryFn: metricApi.getLatest,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', 'recent'],
    queryFn: alertApi.getRecent,
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: recommendationApi.getAll,
  });

  const activeStationsCount = stations.filter((s: any) => s.status === 'ACTIVE').length;
  const criticalAlertsCount = alerts.filter((a: any) => a.severity === 'CRITICAL' || a.alertLevel === 'CRITICAL').length;

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
              <Database className="w-4 h-4 text-blue-600" /> Trạng thái Cơ sở dữ liệu
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Số trạm hiện có:</span>
                <span className="font-bold text-gray-800">{stations.length} trạm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Số trạm hoạt động:</span>
                <span className="font-bold text-green-600">{activeStationsCount} trạm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cảnh báo đang mở:</span>
                <span className="font-bold text-red-600">{alerts.length} cảnh báo</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-2">
            <h4 className="font-bold flex items-center gap-1 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Nạp dữ liệu đo đạc (14k rows)
            </h4>
            <p className="leading-relaxed text-amber-700">
              Hệ thống đã sẵn sàng đón nhận 14,000 dòng dữ liệu của bạn vào bảng <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">measurements</code> qua API Backend.
            </p>
          </div>
        </div>
      }
      centerContent={
        <div className="h-full bg-gray-50 p-6 overflow-y-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-gray-800">Tổng quan Hệ thống Quan trắc</h1>
            <p className="text-xs text-gray-500 mt-1">
              Dữ liệu thời gian thực và khuyến nghị vận hành AI tự động
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
              subtitle="Tất cả các tỉnh ven biển"
            />
            <MetricCard
              title="Trạm đang kết nối"
              value={activeStationsCount}
              unit="trạm"
              icon={<CheckCircle className="w-5 h-5 text-green-600" />}
              color="text-green-600"
              subtitle="Truyền dữ liệu liên tục"
            />
            <MetricCard
              title="Trạm cảnh báo mặn"
              value={criticalAlertsCount}
              unit="trạm"
              icon={<ShieldAlert className="w-5 h-5 text-red-500" />}
              color="text-red-500"
              subtitle="Vượt ngưỡng 4.0‰"
            />
            <MetricCard
              title="Khuyến nghị AI"
              value={recommendations.length}
              unit="gợi ý"
              icon={<Sparkles className="w-5 h-5 text-amber-500" />}
              color="text-amber-600"
              subtitle="Cho cán bộ nông nghiệp"
            />
          </div>

          {/* Recommendations List */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Khuyến nghị vận hành AI tự động
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {recommendations.length > 0 ? (
                recommendations.map((rec: any, idx: number) => (
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
              Danh sách trạm quan trắc trên hệ thống
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2">Mã trạm</th>
                    <th className="px-3 py-2">Tên trạm</th>
                    <th className="px-3 py-2">Tỉnh/Thành</th>
                    <th className="px-3 py-2">Sông</th>
                    <th className="px-3 py-2">Tọa độ</th>
                    <th className="px-3 py-2 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stations.slice(0, 6).map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-bold text-blue-600">{s.code}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{s.name}</td>
                      <td className="px-3 py-2 text-gray-600">{s.province}</td>
                      <td className="px-3 py-2 text-gray-600">{s.riverName || 'N/A'}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-gray-400">
                        {s.latitude?.toFixed(4)}, {s.longitude?.toFixed(4)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full border border-green-200">
                          {s.status}
                        </span>
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
          <p className="text-xs text-gray-500">
            Truy cập tab <strong>Bản đồ độ mặn</strong> để xem bản đồ nhiệt Leaflet toàn vùng ĐBSCL.
          </p>
        </div>
      }
    />
  );
}
