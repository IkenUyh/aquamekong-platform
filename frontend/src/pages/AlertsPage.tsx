import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AlertTriangle, AlertCircle, Info, Settings, CheckCheck, Eye, RotateCcw } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DataTable, Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { SummaryCounter } from '../components/shared/SummaryCounter';
import { HistoryChart } from '../components/HistoryChart';
import { useAlerts } from '../hooks/useAlerts';
import { alertApi } from '../api/alertApi';
import { metricApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { AlertDto, AlertStatus } from '../types';
import { formatNumber, metricLabel, SALINITY_THRESHOLD } from '../utils/salinity';

const HOUR = 3600_000;
const ALL = '';

type Level = 'CRITICAL' | 'WARNING' | 'INFO';

const LEVELS: { level: Level; label: string; color: string; dot: string; icon: React.ReactNode }[] = [
  { level: 'CRITICAL', label: 'Nguy hiểm', color: 'text-red-500', dot: 'bg-red-500', icon: <AlertCircle className="w-5 h-5" /> },
  { level: 'WARNING', label: 'Cảnh báo', color: 'text-yellow-500', dot: 'bg-yellow-500', icon: <AlertTriangle className="w-5 h-5" /> },
  { level: 'INFO', label: 'Theo dõi', color: 'text-blue-500', dot: 'bg-blue-500', icon: <Info className="w-5 h-5" /> },
];

const PERIODS = [
  { value: 24, label: 'Trong 24 giờ' },
  { value: 24 * 7, label: 'Trong 7 ngày' },
  { value: 24 * 30, label: 'Trong 30 ngày' },
  { value: 0, label: 'Tất cả' },
];

const STATUS_LABELS: Record<AlertStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang mở', className: 'bg-red-50 text-red-600' },
  ACKNOWLEDGED: { label: 'Đã xác nhận', className: 'bg-amber-50 text-amber-700' },
  RESOLVED: { label: 'Đã xử lý', className: 'bg-green-50 text-green-700' },
};

const levelOf = (a: AlertDto): Level => (a.alertLevel === 'CRITICAL' || a.alertLevel === 'WARNING' ? a.alertLevel : 'INFO');

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

function StatusPill({ status }: { status?: AlertStatus }) {
  const s = STATUS_LABELS[status ?? 'ACTIVE'];
  return <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

/** Số đo độ mặn của trạm trong 24h trước thời điểm cảnh báo (tới hiện tại nếu cảnh báo còn mới). */
function AlertHistoryChart({ alert }: { alert: AlertDto }) {
  const triggeredAt = new Date(alert.createdAt).getTime();
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ['metrics', 'alert-history', alert.id],
    queryFn: () =>
      metricApi.getByStationWithDateRange(
        alert.stationId,
        new Date(triggeredAt - 24 * HOUR).toISOString(),
        new Date(Math.min(Date.now(), triggeredAt + 6 * HOUR)).toISOString(),
        'salinity'
      ),
  });
  if (isLoading) return <div className="h-full flex items-center justify-center text-xs text-gray-400">Đang tải...</div>;
  return <HistoryChart metrics={metrics} stationName="" threshold={alert.thresholdValue ?? SALINITY_THRESHOLD} />;
}

export function AlertsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole('ROLE_OPERATOR', 'ROLE_ADMIN');
  const { data: alerts = [], isLoading } = useAlerts();

  const [periodHours, setPeriodHours] = useState(24 * 7);
  const [levels, setLevels] = useState<Level[]>(['CRITICAL', 'WARNING', 'INFO']);
  const [status, setStatus] = useState<AlertStatus | ''>(ALL);
  const [province, setProvince] = useState(ALL);
  const [stationId, setStationId] = useState(ALL);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const provinces = useMemo(
    () => [...new Set(alerts.map((a) => a.province).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, 'vi')),
    [alerts]
  );
  const stations = useMemo(() => {
    const byId = new Map<number, string>();
    alerts.forEach((a) => byId.set(a.stationId, a.stationName ?? `Trạm ${a.stationId}`));
    return [...byId].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [alerts]);

  const filtered = useMemo(() => {
    const since = periodHours ? Date.now() - periodHours * HOUR : 0;
    return alerts.filter((a) =>
      new Date(a.createdAt).getTime() >= since &&
      levels.includes(levelOf(a)) &&
      (!status || a.status === status) &&
      (!province || a.province === province) &&
      (!stationId || String(a.stationId) === stationId)
    );
  }, [alerts, periodHours, levels, status, province, stationId]);

  // Số TRẠM có cảnh báo chưa xử lý (đang mở hoặc đã xác nhận), mỗi trạm tính ở mức cao nhất của nó
  const stationsByLevel = useMemo(() => {
    const rank: Record<Level, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };
    const worst = new Map<number, Level>();
    alerts.filter((a) => a.status !== 'RESOLVED').forEach((a) => {
      const lvl = levelOf(a);
      const cur = worst.get(a.stationId);
      if (!cur || rank[lvl] > rank[cur]) worst.set(a.stationId, lvl);
    });
    const values = [...worst.values()];
    return { CRITICAL: values.filter((v) => v === 'CRITICAL').length, WARNING: values.filter((v) => v === 'WARNING').length, INFO: values.filter((v) => v === 'INFO').length };
  }, [alerts]);

  const selectedAlert = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  const updateStatus = useMutation({
    mutationFn: ({ id, next }: { id: number; next: AlertStatus }) => alertApi.updateStatus(id, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const updateError = updateStatus.error
    ? (isAxiosError(updateStatus.error) && typeof updateStatus.error.response?.data?.message === 'string'
        ? updateStatus.error.response.data.message
        : 'Không cập nhật được trạng thái')
    : null;

  const resetFilters = () => {
    setPeriodHours(24 * 7);
    setLevels(['CRITICAL', 'WARNING', 'INFO']);
    setStatus(ALL);
    setProvince(ALL);
    setStationId(ALL);
  };
  const toggleLevel = (l: Level) => setLevels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));

  const columns: Column<AlertDto>[] = [
    { key: 'severity', header: 'Mức độ', render: (a) => <StatusBadge level={levelOf(a)} /> },
    { key: 'station', header: 'Trạm', render: (a) => <span className="font-semibold text-gray-800">{a.stationName ?? `Trạm ${a.stationId}`}</span> },
    { key: 'province', header: 'Tỉnh/Thành', render: (a) => a.province || '—' },
    {
      key: 'value',
      header: 'Giá trị đo',
      render: (a) => {
        const m = metricLabel(a.metricType ?? '');
        const lvl = levelOf(a);
        return (
          <span className={`font-bold ${lvl === 'CRITICAL' ? 'text-red-500' : lvl === 'WARNING' ? 'text-yellow-600' : 'text-gray-700'}`}>
            {m.label} {formatNumber(a.measuredValue)}{m.unit}
          </span>
        );
      },
    },
    { key: 'time', header: 'Thời gian', render: (a) => formatTime(a.createdAt) },
    { key: 'status', header: 'Trạng thái', render: (a) => <StatusPill status={a.status} /> },
  ];

  const selectClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500';

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center text-sm text-gray-400">Đang tải cảnh báo...</div>;
  }

  const metric = selectedAlert ? metricLabel(selectedAlert.metricType ?? '') : null;
  const selectedLevel = selectedAlert ? levelOf(selectedAlert) : 'INFO';

  return (
    <DashboardLayout
      leftPanel={
        <div className="p-5 space-y-6">
          <h2 className="font-bold text-gray-800">Bộ lọc cảnh báo</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="alert-period" className="text-xs font-semibold text-gray-500 mb-1 block">Thời gian</label>
              <select id="alert-period" value={periodHours} onChange={(e) => setPeriodHours(Number(e.target.value))} className={selectClass}>
                {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-gray-500 mb-1 block">Mức độ</legend>
              {LEVELS.map(({ level, label, dot }) => (
                <label key={level} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={levels.includes(level)} onChange={() => toggleLevel(level)}
                    className="rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  {label}
                </label>
              ))}
            </fieldset>

            <div>
              <label htmlFor="alert-status" className="text-xs font-semibold text-gray-500 mb-1 block">Trạng thái</label>
              <select id="alert-status" value={status} onChange={(e) => setStatus(e.target.value as AlertStatus | '')} className={selectClass}>
                <option value={ALL}>Tất cả trạng thái</option>
                {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s].label}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="alert-province" className="text-xs font-semibold text-gray-500 mb-1 block">Tỉnh/Thành phố</label>
              <select id="alert-province" value={province} onChange={(e) => setProvince(e.target.value)} className={selectClass}>
                <option value={ALL}>Tất cả tỉnh thành</option>
                {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="alert-station" className="text-xs font-semibold text-gray-500 mb-1 block">Trạm</label>
              <select id="alert-station" value={stationId} onChange={(e) => setStationId(e.target.value)} className={selectClass}>
                <option value={ALL}>Tất cả trạm</option>
                {stations.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
              </select>
            </div>

            <button onClick={resetFilters}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors mt-6 text-sm">
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      }
      centerContent={
        <div className="h-full bg-white p-4 lg:p-5 flex flex-col gap-4 overflow-hidden">
          <div>
            <h2 className="font-bold text-lg text-gray-800">Danh sách cảnh báo</h2>
            <p className="text-xs text-gray-500">Cảnh báo sinh tự động khi số đo vượt ngưỡng của rule cảnh báo</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-2">
            {LEVELS.map(({ level, label, color, icon }) => (
              <SummaryCounter key={level} count={stationsByLevel[level]} label={`Trạm ${label.toLowerCase()}`} colorClass={color} icon={icon} />
            ))}
          </div>

          <div className="flex-1 overflow-hidden mt-2">
            <DataTable
              data={filtered}
              columns={columns}
              keyExtractor={(a) => a.id}
              selectedRowKey={selectedAlert?.id}
              onRowClick={(a) => setSelectedId(a.id)}
              emptyText={alerts.length === 0 ? 'Chưa có cảnh báo nào' : 'Không có cảnh báo khớp bộ lọc'}
            />
          </div>
        </div>
      }
      rightPanel={
        selectedAlert && metric ? (
          <div className="h-full flex flex-col space-y-4">
            <h2 className="font-bold text-lg text-gray-800 mb-2">Chi tiết cảnh báo</h2>

            <div className={`p-4 rounded-xl border ${selectedLevel === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
              <div className="flex items-center justify-between gap-2 mb-1 font-bold">
                <span className="flex items-center gap-2">
                  {selectedLevel === 'CRITICAL' ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  {LEVELS.find((l) => l.level === selectedLevel)?.label}
                </span>
                <StatusPill status={selectedAlert.status} />
              </div>
              <p className="text-sm opacity-80">{selectedAlert.stationName}{selectedAlert.province && ` · ${selectedAlert.province}`}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{metric.label} khi cảnh báo</p>
                  <p className="text-3xl font-bold text-red-600">{formatNumber(selectedAlert.measuredValue)}{metric.unit}</p>
                  <p className="text-xs text-gray-500 mt-1">Ngưỡng: {formatNumber(selectedAlert.thresholdValue)}{metric.unit}</p>
                </div>
                <div className="text-right text-[11px] text-gray-500 space-y-0.5">
                  <p>Phát hiện: {formatTime(selectedAlert.createdAt)}</p>
                  {selectedAlert.resolvedAt && <p>Xử lý: {formatTime(selectedAlert.resolvedAt)}</p>}
                </div>
              </div>

              {selectedAlert.metricType === 'salinity' && (
                <div className="h-[200px] -mx-4">
                  <AlertHistoryChart alert={selectedAlert} />
                </div>
              )}

              <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 leading-relaxed">{selectedAlert.message}</p>
            </div>

            {canManage && (
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                <h4 className="font-bold text-sm text-gray-800">Xử lý cảnh báo</h4>
                <div className="flex gap-2">
                  {selectedAlert.status === 'ACTIVE' && (
                    <button disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: selectedAlert.id, next: 'ACKNOWLEDGED' })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-medium disabled:opacity-60">
                      <Eye className="w-4 h-4" /> Xác nhận
                    </button>
                  )}
                  {selectedAlert.status !== 'RESOLVED' ? (
                    <button disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: selectedAlert.id, next: 'RESOLVED' })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60">
                      <CheckCheck className="w-4 h-4" /> Đã xử lý
                    </button>
                  ) : (
                    <button disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: selectedAlert.id, next: 'ACTIVE' })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-60">
                      <RotateCcw className="w-4 h-4" /> Mở lại
                    </button>
                  )}
                </div>
                {updateError && <p role="alert" className="text-xs text-red-600">{updateError}</p>}
              </div>
            )}

            {selectedAlert.metricType === 'salinity' && (
              <div className="p-4 rounded-xl border border-blue-100 shadow-sm bg-blue-50/30">
                <div className="flex items-center gap-2 text-blue-700 font-bold mb-3">
                  <Settings className="w-5 h-5" />
                  Khuyến nghị
                </div>
                <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5 marker:text-blue-500">
                  <li>Đóng cống lấy nước ngọt khi độ mặn {'>'} {SALINITY_THRESHOLD}‰.</li>
                  <li>Tăng cường trữ nước nội đồng.</li>
                  <li>Ưu tiên cấp nước sinh hoạt.</li>
                </ul>
              </div>
            )}
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
