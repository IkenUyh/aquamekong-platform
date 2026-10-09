import React, { useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ForecastChart } from '../components/ForecastChart';
import { StatusBadge } from '../components/shared/StatusBadge';
import { StationsMiniMap } from '../components/shared/StationsMiniMap';
import { ForecastAccuracyCard, StationAccuracy } from '../components/ForecastAccuracy';
import { forecastApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useStationsList } from '../hooks/useStations';
import { forecastQueryKey, useStgnnModelInfo } from '../hooks/useForecast';
import { useForecastAccuracy } from '../hooks/useForecastAccuracy';
import type { SalinityForecast, Station, StgnnModelInfo } from '../types';
import { classifySalinity, formatNumber, riverOf, SALINITY_THRESHOLD } from '../utils/salinity';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const HORIZONS = [7, 14];
const ALL = '';

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return { weekday: WEEKDAYS[d.getDay()], label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) };
};

const levelOf = (v: number | null | undefined) => {
  const c = classifySalinity(v);
  return c === 'HIGH' ? 'CRITICAL' : c === 'MEDIUM' ? 'WARNING' : 'SAFE';
};

const formatDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('vi-VN');

/** Tên mô hình theo model_version mà ML service ghi vào lượt dự báo */
function modelLabel(version?: string): string {
  if (!version) return '';
  if (version.startsWith('st-gnn')) return 'ST-GNN';
  if (version.startsWith('prophet')) return 'Prophet';
  if (version.startsWith('hybrid')) return 'ARIMA-CNN';
  if (version.startsWith('statistical-v1')) return 'Xu hướng thống kê';
  if (version.startsWith('statistical')) return 'Giữ nguyên số mới nhất';
  if (version.startsWith('simulated')) return 'Mô phỏng';
  return version;
}

/** Thẻ điểm ST-GNN trên tập test, so với cách giữ nguyên giá trị cũ */
function StgnnScoreCard({ info }: { info: StgnnModelInfo }) {
  const pct = (a: number, b: number) => Math.round((100 * (b - a)) / b);
  return (
    <div className="card p-3 text-xs text-gray-600 space-y-1">
      <p className="text-sm font-semibold text-gray-900">
        ST-GNN · {info.stations.length}/{info.all_stations.length} trạm của mô hình
      </p>
      {info.horizons.map((h) => {
        const ev = info.evaluation[`h${h}`];
        if (!ev) return null;
        const { stgnn, naive } = ev.overall;
        return (
          <p key={h} className="num">
            Dự báo {h} ngày: sai số trung bình {formatNumber(stgnn.mae)}‰, giữ nguyên giá trị cũ {formatNumber(naive.mae)}‰
            {' '}({pct(stgnn.mae, naive.mae) >= 0 ? `tốt hơn ${pct(stgnn.mae, naive.mae)}%` : `kém hơn ${-pct(stgnn.mae, naive.mae)}%`});
            {' '}khoảng dự báo chứa {Math.round(ev.interval_coverage * 100)}% giá trị thật
          </p>
        );
      })}
      <p className="text-gray-400">
        Chấm trên {info.evaluation[`h${info.horizons[0]}`]?.test_days ?? '—'} ngày cuối của dữ liệu (tập kiểm tra), dữ liệu tới {formatDay(info.trained_until)}.
        Trạm còn lại dùng mô hình khác.
      </p>
    </div>
  );
}

interface StationForecast {
  station: Station;
  forecasts: SalinityForecast[];
  isLoading: boolean;
  isError: boolean;
}

/** Nhận xét sinh từ dự báo: trạm sẽ vượt ngưỡng (ngày đầu tiên) và trạm có xu hướng tăng. */
function buildInsights(items: StationForecast[]): string[] {
  const ready = items.filter((i) => i.forecasts.length > 0);
  if (ready.length === 0) return [];

  const insights: string[] = [];
  const exceeding = ready
    .map((i) => ({ i, first: i.forecasts.find((f) => f.predictedSalinity > SALINITY_THRESHOLD) }))
    .filter((x) => x.first);
  if (exceeding.length > 0) {
    insights.push(
      `Dự báo vượt ngưỡng ${SALINITY_THRESHOLD}‰: ` +
        exceeding.map(({ i, first }) => `${i.station.name} (từ ${dayLabel(first!.forecastDate).label}, ${formatNumber(first!.predictedSalinity)}‰)`).join('; ') + '.'
    );
  } else {
    insights.push(`Không trạm nào được dự báo vượt ngưỡng ${SALINITY_THRESHOLD}‰ trong kỳ dự báo.`);
  }

  const rising = ready.filter((i) => {
    const f = i.forecasts;
    return f[f.length - 1].predictedSalinity - f[0].predictedSalinity >= 0.3;
  });
  if (rising.length > 0) insights.push(`Xu hướng tăng: ${rising.map((i) => i.station.name).join(', ')}.`);

  const peak = ready
    .flatMap((i) => i.forecasts.map((f) => ({ name: i.station.name, f })))
    .reduce((a, b) => (b.f.predictedSalinity > a.f.predictedSalinity ? b : a));
  insights.push(`Cao nhất: ${peak.name} ${formatNumber(peak.f.predictedSalinity)}‰ vào ${dayLabel(peak.f.forecastDate).label}.`);

  const simulated = ready.filter((i) => i.forecasts[0].modelVersion?.startsWith('simulated'));
  if (simulated.length > 0) {
    insights.push(`Lưu ý: ${simulated.map((i) => i.station.name).join(', ')} chưa đủ dữ liệu, đang dùng dự báo mô phỏng.`);
  }
  return insights;
}

export function ForecastPage() {
  const queryClient = useQueryClient();
  const { data: stations = [] } = useStationsList();

  const [days, setDays] = useState(7);
  const [province, setProvince] = useState(ALL);
  // null = chưa chọn tay -> mặc định tất cả trạm
  const [picked, setPicked] = useState<number[] | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [rerunning, setRerunning] = useState(false);
  const { user } = useAuth();

  const provinces = useMemo(
    () => [...new Set(stations.map((s) => s.province).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, 'vi')),
    [stations]
  );
  const visibleStations = stations.filter((s) => !province || s.province === province);
  const selectedIds = picked ?? visibleStations.map((s) => s.id);
  const selected = visibleStations.filter((s) => selectedIds.includes(s.id));

  const results = useQueries({
    queries: selected.map((s) => ({
      queryKey: forecastQueryKey(s.id, days),
      queryFn: () => forecastApi.getOrPredict(s.id, days),
      staleTime: 10 * 60_000,
    })),
  });
  const items: StationForecast[] = selected.map((station, i) => ({
    station,
    forecasts: results[i]?.data ?? [],
    isLoading: results[i]?.isLoading ?? true,
    isError: results[i]?.isError ?? false,
  }));

  // Các trạm có thể dùng mô hình khác nhau (ST-GNN chỉ có vài mốc), nên tra theo ngày chứ không theo vị trí
  const dates = [...new Set(items.flatMap((i) => i.forecasts.map((f) => f.forecastDate)))].sort();
  const dayIndex = Math.min(selectedDay, Math.max(0, dates.length - 1));
  const selectedDate = dates[dayIndex];
  const forecastOn = (forecasts: SalinityForecast[], date?: string) => forecasts.find((f) => f.forecastDate === date);
  const { data: modelInfo } = useStgnnModelInfo();
  // Ngày dữ liệu cuối của ST-GNN, khi đã cũ hơn hôm nay
  const dataUntil = items.flatMap((i) => i.forecasts).find((f) => f.dataUntil)?.dataUntil ?? null;
  const insights = buildInsights(items);
  // Thẻ điểm ST-GNN chỉ khi có trạm đang hiển thị dự báo của nó (dữ liệu ST-GNN cũ thì ML dùng mô hình khác)
  const { data: accuracy } = useForecastAccuracy();
  const usesStgnn = items.some((i) => i.forecasts.some((f) => f.modelVersion?.startsWith('st-gnn')));

  const togglePicked = (id: number) =>
    setPicked((prev) => {
      const base = prev ?? visibleStations.map((s) => s.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });

  // Chạy ML mới cho các trạm đang chọn (ghi đè lượt dự báo mới nhất)
  const rerun = async () => {
    setRerunning(true);
    try {
      await Promise.allSettled(selected.map((s) => forecastApi.predict(s.id, days)));
      await queryClient.invalidateQueries({ queryKey: ['forecast'] });
    } finally {
      setRerunning(false);
    }
  };

  const selectClass = 'field';

  return (
    <DashboardLayout
      leftPanel={
        <div className="p-5 space-y-6">
          <h2 className="font-semibold text-gray-900">Bộ lọc dự báo</h2>

          <div className="space-y-4 border-b border-gray-100 pb-6">
            <div>
              <label htmlFor="forecast-days" className="field-label">Thời gian dự báo</label>
              <select id="forecast-days" value={days} onChange={(e) => { setDays(Number(e.target.value)); setSelectedDay(0); }} className={selectClass}>
                {HORIZONS.map((d) => <option key={d} value={d}>{d} ngày tới</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="forecast-province" className="field-label">Tỉnh/Thành phố</label>
              <select id="forecast-province" value={province} onChange={(e) => { setProvince(e.target.value); setPicked(null); }} className={selectClass}>
                <option value={ALL}>Tất cả</option>
                {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <fieldset>
              <legend className="field-label mb-2">
                Trạm quan tâm ({selected.length}/{visibleStations.length})
              </legend>
              <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                {visibleStations.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => togglePicked(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              <div className="flex gap-3 text-xs font-medium">
                <button onClick={() => setPicked(visibleStations.map((s) => s.id))} className="text-primary-500 hover:underline">Chọn tất cả</button>
                <button onClick={() => setPicked([])} className="text-gray-500 hover:underline">Bỏ chọn</button>
              </div>
            </fieldset>

            {user ? (
              <button
                onClick={rerun}
                disabled={rerunning || selected.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition-colors text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${rerunning ? 'animate-spin' : ''}`} />
                {rerunning ? 'Đang chạy mô hình...' : 'Chạy lại dự báo'}
              </button>
            ) : (
              <p className="text-xs text-gray-500">
                <Link to="/login" state={{ from: '/forecast' }} className="font-medium text-primary hover:underline">Đăng nhập</Link>{' '}
                để chạy lại mô hình dự báo.
              </p>
            )}
            {user && (
              <p className="text-[11px] text-gray-400">
                Dự báo được lưu lại; trang tự chạy mô hình khi trạm chưa có dự báo hoặc dự báo đã cũ.
              </p>
            )}
          </div>
        </div>
      }
      centerContent={
        <div className="h-full flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* Biểu đồ từng trạm */}
          <div className="lg:flex-1 p-4 lg:p-5 lg:overflow-y-auto bg-gray-50 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-gray-900">Dự báo độ mặn {days} ngày tới</h2>
              <p className="text-xs text-gray-500">Chọn một ngày để xem bản đồ dự báo của ngày đó</p>
            </div>

            {dataUntil && (
              <p className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                Dự báo ST-GNN tính từ dữ liệu ngày <span className="num">{formatDay(dataUntil)}</span> (dữ liệu mới nhất),
                nên các ngày dự báo có thể đã qua. Mô hình chỉ có 2 mốc: sau 1 ngày và sau 7 ngày.
              </p>
            )}
            {modelInfo && usesStgnn && <StgnnScoreCard info={modelInfo} />}
            {accuracy && <ForecastAccuracyCard accuracy={accuracy} />}

            {dates.length > 0 && (
              <div className="flex shrink-0 gap-2 bg-white p-2 rounded-lg border border-gray-200 overflow-x-auto">
                {dates.map((d, i) => {
                  const { weekday, label } = dayLabel(d);
                  const active = i === dayIndex;
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDay(i)}
                      aria-pressed={active}
                      className={`flex-1 min-w-[56px] text-center py-2 rounded-lg ${active ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'}`}
                    >
                      <p className={`text-xs font-bold ${active ? 'text-primary-600' : 'text-gray-500'}`}>{weekday}</p>
                      <p className={`text-[10px] ${active ? 'text-primary-400' : 'text-gray-400'}`}>{label}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {selected.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-10">Chọn ít nhất một trạm ở bộ lọc bên trái</div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {items.map(({ station, forecasts, isLoading, isError }) => {
                const dayForecast = forecastOn(forecasts, selectedDate);
                const dayValue = dayForecast?.predictedSalinity;
                const model = modelLabel(forecasts[0]?.modelVersion);
                return (
                  <div key={station.id} className="card p-4">
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-1 truncate">{station.name}</h4>
                        <p className="text-xs text-gray-500">{model ? `Mô hình: ${model}` : riverOf(station) ?? '—'}</p>
                        <p className="text-sm mt-1 text-gray-600">
                          Hiện tại <span className="font-semibold text-gray-900">{formatNumber(station.latestSalinity)}‰</span>
                          {dayValue != null && (
                            <> · {dayLabel(dayForecast!.forecastDate).label}: <span className="font-semibold text-gray-900">{formatNumber(dayValue)}‰</span></>
                          )}
                        </p>
                      </div>
                      <StatusBadge level={levelOf(dayValue ?? station.latestSalinity)} />
                    </div>
                    <div className="h-[140px] -mx-2">
                      {isLoading ? (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400">Đang chạy dự báo...</div>
                      ) : isError ? (
                        <div className="h-full flex items-center justify-center text-xs text-red-400">Không lấy được dự báo</div>
                      ) : forecasts.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400">Chưa có dữ liệu dự báo</div>
                      ) : (
                        <ForecastChart forecasts={forecasts} heightClass="h-full" />
                      )}
                    </div>
                    {accuracy && (
                      <StationAccuracy stationId={station.id} seriesLead={accuracy.seriesLead}
                        accuracy={accuracy.stations.find((a) => a.stationId === station.id)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bản đồ dự báo của ngày đang chọn */}
          <div className="w-full lg:w-[40%] lg:min-w-[320px] h-[480px] lg:h-auto shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Bản đồ dự báo độ mặn {dates[dayIndex] ? `ngày ${dayLabel(dates[dayIndex]).label}` : ''}
              </h3>
            </div>
            <div className="flex-1 relative">
              <StationsMiniMap
                stations={items.map(({ station, forecasts }) => ({
                  id: station.id,
                  name: station.name,
                  latitude: station.latitude,
                  longitude: station.longitude,
                  salinity: forecastOn(forecasts, selectedDate)?.predictedSalinity,
                }))}
              />
              {insights.length > 0 && (
                <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur rounded-lg p-4 shadow-lg border border-gray-200 z-[1000]">
                  <h4 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2">
                    Nhận xét chung
                  </h4>
                  <ul className="text-xs text-gray-600 space-y-1 pl-4 list-disc marker:text-primary-500">
                    {insights.map((text) => <li key={text}>{text}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
}
