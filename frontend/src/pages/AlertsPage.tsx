import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AlertCardList } from '../components/AlertCardList';
import { HistoryChart } from '../components/HistoryChart';
import { useAlerts } from '../hooks/useAlerts';
import { useStationsList } from '../hooks/useStations';
import { alertApi } from '../api/alertApi';
import { metricApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PushSettings } from '../components/PushSettings';
import type { AlertDto, AlertStatus } from '../types';
import { formatMeasuredAt, formatNumber, formatSalinity, isReporting, metricLabel, SALINITY_THRESHOLD } from '../utils/salinity';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const ALL = '';

type Level = 'CRITICAL' | 'WARNING' | 'INFO';

const LEVELS: { level: Level; label: string; dot: string }[] = [
  { level: 'CRITICAL', label: 'Nguy hiểm', dot: 'bg-red-500' },
  { level: 'WARNING', label: 'Cảnh báo', dot: 'bg-yellow-500' },
  { level: 'INFO', label: 'Theo dõi', dot: 'bg-gray-400' },
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

/** Số đo RYNAN theo ngày ghi lúc 00:00 thì chỉ hiện ngày; có giờ thật thì kèm giờ */
const formatTime = (iso: string) => formatMeasuredAt(iso, false, true);

function StatusPill({ status }: { status?: AlertStatus }) {
  const s = STATUS_LABELS[status ?? 'ACTIVE'];
  return <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

/** Số đo độ mặn của trạm 14 ngày trước cảnh báo tới 7 ngày sau (hoặc tới nay). Số đo RYNAN theo ngày. */
function AlertHistoryChart({ alert }: { alert: AlertDto }) {
  const triggeredAt = new Date(alert.createdAt).getTime();
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ['metrics', 'alert-history', alert.id],
    queryFn: () =>
      metricApi.getByStationWithDateRange(
        alert.stationId,
        new Date(triggeredAt - 14 * DAY).toISOString(),
        new Date(Math.min(Date.now(), triggeredAt + 7 * DAY)).toISOString(),
        'salinity'
      ),
  });
  if (isLoading) return <div className="h-full flex items-center justify-center text-xs text-gray-400">Đang tải...</div>;
  return <HistoryChart metrics={metrics} stationName="" threshold={alert.thresholdValue ?? SALINITY_THRESHOLD} />;
}

/**
 * Cảnh báo chỉ sinh từ số đo mới (backend bỏ qua số đo cũ hơn 3 ngày). Khi dữ liệu đã cũ,
 * nói rõ lý do trang trống và trỏ sang trang Phát lại để xem cảnh báo trong quá khứ.
 */
function StaleDataNotice() {
  const { data: stations = [] } = useStationsList();
  const latest = stations.map((s) => s.lastMeasuredAt).filter((t): t is string => !!t).sort().pop();
  if (!latest || isReporting(latest)) return null;
  const days = Math.floor((Date.now() - new Date(latest).getTime()) / 86_400_000);
  return (
    <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
      Số đo mới nhất là ngày <span className="num">{formatMeasuredAt(latest, false, true)}</span> ({days} ngày trước).
      Cảnh báo chỉ được tạo khi có số đo mới, nên danh sách sẽ trống tới khi nạp dữ liệu RYNAN mới.
      Xem lại cảnh báo trong quá khứ ở trang{' '}
      <Link to="/replay" className="font-medium text-primary hover:underline">Phát lại</Link>.
    </p>
  );
}

export function AlertsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole('ROLE_OPERATOR', 'ROLE_ADMIN');
  const { data: alerts = [], isLoading, isError } = useAlerts();
  // Số đo mới nhất của từng trạm: số lúc cảnh báo có thể đã cũ nhiều ngày
  const { data: stationList = [] } = useStationsList();

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


  const selectClass = 'field';

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center text-sm text-gray-400">Đang tải cảnh báo...</div>;
  }

  const metric = selectedAlert ? metricLabel(selectedAlert.metricType ?? '') : null;
  const selectedLevel = selectedAlert ? levelOf(selectedAlert) : 'INFO';
  const currentSalinity = selectedAlert?.metricType === 'salinity'
    ? stationList.find((s) => s.id === selectedAlert.stationId)?.latestSalinity ?? null
    : null;
  const currentAt = selectedAlert ? stationList.find((s) => s.id === selectedAlert.stationId)?.lastMeasuredAt : null;

  return (
    <DashboardLayout
      leftPanel={
        <div className="p-5 space-y-6">
          <h2 className="font-semibold text-gray-900">Bộ lọc cảnh báo</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="alert-period" className="field-label">Thời gian</label>
              <select id="alert-period" value={periodHours} onChange={(e) => setPeriodHours(Number(e.target.value))} className={selectClass}>
                {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <fieldset className="space-y-2">
              <legend className="field-label">Mức độ</legend>
              {LEVELS.map(({ level, label, dot }) => (
                <label key={level} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={levels.includes(level)} onChange={() => toggleLevel(level)}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  {label}
                </label>
              ))}
            </fieldset>

            <div>
              <label htmlFor="alert-status" className="field-label">Trạng thái</label>
              <select id="alert-status" value={status} onChange={(e) => setStatus(e.target.value as AlertStatus | '')} className={selectClass}>
                <option value={ALL}>Tất cả trạng thái</option>
                {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s].label}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="alert-province" className="field-label">Tỉnh/Thành phố</label>
              <select id="alert-province" value={province} onChange={(e) => setProvince(e.target.value)} className={selectClass}>
                <option value={ALL}>Tất cả tỉnh thành</option>
                {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="alert-station" className="field-label">Trạm</label>
              <select id="alert-station" value={stationId} onChange={(e) => setStationId(e.target.value)} className={selectClass}>
                <option value={ALL}>Tất cả trạm</option>
                {stations.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
              </select>
            </div>

            <button onClick={resetFilters}
              className="btn-primary w-full mt-6">
              Đặt lại bộ lọc
            </button>
          </div>

          <PushSettings compact />
        </div>
      }
      centerContent={
        <div className="h-full bg-gray-50 p-4 lg:p-5 flex flex-col gap-4 overflow-hidden">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Danh sách cảnh báo</h2>
            <p className="text-xs text-gray-500">Cảnh báo sinh tự động khi số đo vượt ngưỡng của rule cảnh báo</p>
          </div>

          <StaleDataNotice />

          {/* Một dòng tóm tắt thay cho 3 thẻ đếm: phần lớn thời gian chỉ có 0–1 trạm mỗi mức */}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span>Trạm có cảnh báo chưa xử lý:</span>
            {LEVELS.map(({ level, label, dot }) => (
              <span key={level} className="flex items-center gap-1.5">
                <span className={`dot ${dot}`} />
                <span className="num font-semibold text-gray-900">{stationsByLevel[level]}</span> {label.toLowerCase()}
              </span>
            ))}
            <span className="text-gray-500 num">· {filtered.length} cảnh báo khớp bộ lọc</span>
          </p>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <AlertCardList
              alerts={filtered}
              stations={stationList}
              selectedId={selectedAlert?.id ?? null}
              onSelect={setSelectedId}
              emptyText={
                isError ? 'Không tải được danh sách cảnh báo. Trang sẽ tự thử lại.'
                  : alerts.length === 0 ? 'Chưa có cảnh báo nào' : 'Không có cảnh báo khớp bộ lọc'
              }
            />
          </div>
        </div>
      }
      rightPanel={
        selectedAlert && metric ? (
          <div className="h-full flex flex-col space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Chi tiết cảnh báo</h2>

            <div className={`p-4 rounded-lg border ${selectedLevel === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
              <div className="flex items-center justify-between gap-2 mb-1 font-bold">
                <span className="flex items-center gap-2">
                  {LEVELS.find((l) => l.level === selectedLevel)?.label}
                </span>
                <StatusPill status={selectedAlert.status} />
              </div>
              <p className="text-sm opacity-80">{selectedAlert.stationName}{selectedAlert.province && ` · ${selectedAlert.province}`}</p>
            </div>

            <div className="card p-4">
              <div className="flex justify-between items-start mb-4 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{metric.label} lúc cảnh báo</p>
                  <p className="text-2xl font-semibold text-red-600">
                    {selectedAlert.metricType === 'salinity' ? formatSalinity(selectedAlert.measuredValue) : formatNumber(selectedAlert.measuredValue)}{metric.unit}
                  </p>
                  {currentSalinity != null && (
                    <p className="text-sm text-gray-700 mt-1">
                      Hiện tại <span className={`font-semibold num ${currentSalinity > (selectedAlert.thresholdValue ?? SALINITY_THRESHOLD) ? 'text-red-700' : 'text-gray-900'}`}>{formatSalinity(currentSalinity)}{metric.unit}</span>
                      {currentAt && <span className="text-xs text-gray-500 num whitespace-nowrap"> ({formatMeasuredAt(currentAt)})</span>}
                    </p>
                  )}
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
              <div className="card p-4 space-y-2">
                <h4 className="font-bold text-sm text-gray-800">Xử lý cảnh báo</h4>
                <div className="flex gap-2">
                  {selectedAlert.status === 'ACTIVE' && (
                    <button disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: selectedAlert.id, next: 'ACKNOWLEDGED' })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-medium disabled:opacity-60">
                      Xác nhận
                    </button>
                  )}
                  {selectedAlert.status !== 'RESOLVED' ? (
                    <button disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: selectedAlert.id, next: 'RESOLVED' })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60">
                      Đã xử lý
                    </button>
                  ) : (
                    <button disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: selectedAlert.id, next: 'ACTIVE' })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-60">
                      Mở lại
                    </button>
                  )}
                </div>
                {updateError && <p role="alert" className="text-xs text-red-600">{updateError}</p>}
              </div>
            )}

            {selectedAlert.metricType === 'salinity' && (
              <div className="p-4 rounded-lg border border-primary-100 bg-primary-50/30">
                <div className="flex items-center gap-2 text-primary-700 font-bold mb-3">
                  Khuyến nghị
                </div>
                <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5 marker:text-primary-500">
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
