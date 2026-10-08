import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DataTable, Column } from '../components/shared/DataTable';
import { StationsMiniMap } from '../components/shared/StationsMiniMap';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useStationsList } from '../hooks/useStations';
import { Search } from 'lucide-react';
import type { Station } from '../types';
import { formatNumber, isReporting, ONLINE_WINDOW_HOURS, METRIC_LABELS, metricLabel, SALINITY_THRESHOLD } from '../utils/salinity';

const ALL = '';

const uniqueSorted = (values: (string | undefined)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'vi'));

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function StationsPage() {
  const { data: stationsList = [] } = useStationsList();
  const [province, setProvince] = useState(ALL);
  const [river, setRiver] = useState(ALL);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const provinces = useMemo(() => uniqueSorted(stationsList.map((s) => s.province)), [stationsList]);
  const rivers = useMemo(() => uniqueSorted(stationsList.map((s) => s.riverName)), [stationsList]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return stationsList.filter((s) =>
      (!province || s.province === province) &&
      (!river || s.riverName === river) &&
      (metrics.length === 0 || metrics.some((m) => s.metricTypes?.includes(m))) &&
      (!q || normalize([s.name, s.code, s.riverName, s.province].filter(Boolean).join(' ')).includes(q))
    );
  }, [stationsList, province, river, metrics, query]);

  const toggleMetric = (m: string) =>
    setMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  const resetFilters = () => {
    setProvince(ALL);
    setRiver(ALL);
    setMetrics([]);
    setQuery('');
  };

  const columns: Column<Station>[] = [
    { key: 'name', header: 'Tên trạm', render: (s) => (
      <div>
        <p className="font-semibold text-gray-800">{s.name}</p>
        <p className="text-xs text-gray-400 font-mono">{s.code}</p>
      </div>
    ) },
    { key: 'location', header: 'Tỉnh/Thành · Sông', render: (s) => (
      <div className="whitespace-nowrap">
        <p className="text-gray-800">{s.province ?? '—'}</p>
        <p className="text-xs text-gray-400">{s.riverName ?? '—'}</p>
      </div>
    ) },
    { key: 'type', header: 'Chỉ số đo', render: (s) =>
      s.metricTypes?.length ? s.metricTypes.map((m) => metricLabel(m).label).join(', ') : <span className="text-gray-400">Chưa có số đo</span> },
    {
      key: 'salinity',
      header: 'Độ mặn (‰)',
      render: (s) => (
        <span className={(s.latestSalinity ?? 0) > SALINITY_THRESHOLD ? 'text-red-500 font-bold' : ''}>
          {formatNumber(s.latestSalinity)}
        </span>
      ),
      align: 'right',
    },
    {
      key: 'lastMeasuredAt',
      header: 'Số đo gần nhất',
      render: (s) => s.lastMeasuredAt
        ? new Date(s.lastMeasuredAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
        : '—',
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (s) => {
        if (s.status === 'INACTIVE') return <StatusBadge level="INFO" text="Ngừng hoạt động" />;
        return isReporting(s.lastMeasuredAt)
          ? <StatusBadge level="SAFE" text="Đang truyền" />
          : <span title={`Không có số đo trong ${ONLINE_WINDOW_HOURS} giờ qua`}><StatusBadge level="WARNING" text="Mất tín hiệu" /></span>;
      },
    },
  ];

  const selectClass = 'field';

  return (
    <DashboardLayout
      leftPanel={
        <div className="p-5 space-y-6">
          <h2 className="font-semibold text-gray-900">Bộ lọc & tìm kiếm</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="filter-province" className="field-label">Tỉnh/Thành phố</label>
              <select id="filter-province" value={province} onChange={(e) => setProvince(e.target.value)} className={selectClass}>
                <option value={ALL}>Tất cả tỉnh thành</option>
                {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="filter-river" className="field-label">Sông</label>
              <select id="filter-river" value={river} onChange={(e) => setRiver(e.target.value)} className={selectClass}>
                <option value={ALL}>Tất cả sông</option>
                {rivers.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <fieldset>
              <legend className="field-label mb-2">Chỉ số đo</legend>
              <div className="space-y-2">
                {Object.entries(METRIC_LABELS).map(([key, { label, unit }]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={metrics.includes(key)}
                      onChange={() => toggleMetric(key)}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    {label} ({unit})
                  </label>
                ))}
              </div>
            </fieldset>

            <button onClick={resetFilters}
              className="btn-primary w-full mt-6">
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      }
      centerContent={
        <div className="h-full bg-white p-4 lg:p-5 flex flex-col gap-4 overflow-hidden">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Danh sách trạm quan trắc</h2>
              <p className="text-xs text-gray-500">
                {filtered.length === stationsList.length
                  ? `${stationsList.length} trạm quan trắc`
                  : `${filtered.length} / ${stationsList.length} trạm khớp bộ lọc`}
              </p>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                aria-label="Tìm trạm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên trạm, mã, sông, tỉnh..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm w-full sm:w-64 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <DataTable
              data={filtered}
              columns={columns}
              keyExtractor={(s) => s.id}
              emptyText="Không có trạm nào khớp bộ lọc"
            />
          </div>
        </div>
      }
      rightPanel={
        <div className="h-full flex flex-col bg-white overflow-hidden rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 text-sm">Vị trí các trạm quan trắc</h3>
          </div>
          <div className="flex-1 relative min-h-[300px]">
            <StationsMiniMap
              stations={filtered.map((s) => ({ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude, salinity: s.latestSalinity }))}
            />
          </div>
        </div>
      }
    />
  );
}
