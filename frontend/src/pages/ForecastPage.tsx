import React, { useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ForecastChart } from '../components/ForecastChart';
import { ForecastGrid, type StationForecast } from '../components/ForecastGrid';
import { StationsMiniMap } from '../components/shared/StationsMiniMap';
import { EarlyWarningCard, ForecastAccuracyCard, StationAccuracy } from '../components/ForecastAccuracy';
import { forecastApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useStationsList } from '../hooks/useStations';
import { forecastQueryKey, useStgnnModelInfo } from '../hooks/useForecast';
import { useEarlyWarningEvaluation, useForecastAccuracy } from '../hooks/useForecastAccuracy';
import type { StationAccuracy as StationAccuracyData } from '../api/accuracyApi';
import type { SalinityForecast, StgnnModelInfo } from '../types';
import { formatDay, formatFullDate, formatMeasuredAt, formatNumber, formatSalinity, isReporting, SALINITY_THRESHOLD } from '../utils/salinity';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const HORIZONS = [7, 14];
const ALL = '';

const dayLabel = (iso: string) => ({ weekday: WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()], label: formatDay(iso) });

/** Ngày YYYY-MM-DD dạng "07/10/2026" */
const fullDay = (iso: string) => formatFullDate(new Date(`${iso}T00:00:00`));

/** Tên mô hình theo model_version mà ML service ghi vào lượt dự báo */
function modelLabel(version?: string): string {
  if (!version) return '';
  if (version.startsWith('st-gnn')) return 'ST-GNN';
  if (version.startsWith('gb-risk')) return 'Số mới nhất + mô hình rủi ro';
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
        Chấm trên {info.evaluation[`h${info.horizons[0]}`]?.test_days ?? '—'} ngày cuối của dữ liệu (tập kiểm tra), dữ liệu tới {fullDay(info.trained_until)}.
        Trạm còn lại dùng mô hình khác.
      </p>
    </div>
  );
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
        exceeding.map(({ i, first }) => `${i.station.name} (từ ${dayLabel(first!.forecastDate).label}, ${formatSalinity(first!.predictedSalinity)}‰)`).join('; ') + '.'
    );
  } else {
    insights.push(`Không trạm nào được dự báo vượt ngưỡng ${SALINITY_THRESHOLD}‰ trong kỳ dự báo.`);
  }

  // Mô hình rủi ro: dự báo giữ nguyên số mới nhất, nhưng mức có thể lên tới vượt ngưỡng thì báo trước
  const exceedingIds = new Set(exceeding.map(({ i }) => i.station.id));
  const atRisk = ready
    .filter((i) => !exceedingIds.has(i.station.id))
    .map((i) => {
      const risky = i.forecasts.filter((f) => (f.riskSalinity ?? 0) > SALINITY_THRESHOLD);
      return { i, first: risky[0], peak: Math.max(...risky.map((f) => f.riskSalinity ?? 0)) };
    })
    .filter((x) => x.first)
    .sort((a, b) => a.first!.forecastDate.localeCompare(b.first!.forecastDate));
  if (atRisk.length > 0) {
    insights.push(
      `Có thể vượt ${SALINITY_THRESHOLD}‰, nên trữ nước ngọt trước: ` +
        atRisk.map(({ i, first, peak }) => `${i.station.name} (từ ${dayLabel(first!.forecastDate).label}, có thể tới ${formatSalinity(peak)}‰)`).join('; ') + '.'
    );
  }

  const rising = ready.filter((i) => {
    const f = i.forecasts;
    return f[f.length - 1].predictedSalinity - f[0].predictedSalinity >= 0.3;
  });
  if (rising.length > 0) insights.push(`Xu hướng tăng: ${rising.map((i) => i.station.name).join(', ')}.`);

  const peak = ready
    .flatMap((i) => i.forecasts.map((f) => ({ name: i.station.name, f })))
    .reduce((a, b) => (b.f.predictedSalinity > a.f.predictedSalinity ? b : a));
  insights.push(`Cao nhất: ${peak.name} ${formatSalinity(peak.f.predictedSalinity)}‰ vào ${dayLabel(peak.f.forecastDate).label}.`);

  const simulated = ready.filter((i) => i.forecasts[0].modelVersion?.startsWith('simulated'));
  if (simulated.length > 0) {
    insights.push(`Lưu ý: ${simulated.map((i) => i.station.name).join(', ')} chưa đủ dữ liệu, đang dùng dự báo mô phỏng.`);
  }
  return insights;
}

/** Chi tiết một trạm, mở ngay dưới dòng của trạm trong lưới */
function StationForecastDetail({ item, date, accuracy, compare }: {
  item: StationForecast;
  date?: string;
  accuracy: { seriesLead: number; station: StationAccuracyData | undefined } | null;
  /** Mở bằng cột sai số: hiện sẵn biểu đồ dự báo đặt cạnh số đo thật */
  compare: boolean;
}) {
  const { station, forecasts } = item;
  const day = forecasts.find((f) => f.forecastDate === date);
  const model = modelLabel(forecasts[0]?.modelVersion);
  const mayExceed = day?.riskSalinity != null && day.riskSalinity > SALINITY_THRESHOLD && day.predictedSalinity <= SALINITY_THRESHOLD;
  return (
    <div className="space-y-3 p-4">
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
        <span>{item.silentSince ? 'Số đo cuối' : 'Hiện tại'} <span className="font-semibold text-gray-900 num">{formatSalinity(station.latestSalinity)}‰</span></span>
        {day && (
          <span><span className="num">{dayLabel(day.forecastDate).label}</span>: <span className="font-semibold text-gray-900 num">{formatSalinity(day.predictedSalinity)}‰</span></span>
        )}
        {day?.riskSalinity != null && (
          <span className={mayExceed ? 'text-red-700' : undefined}>
            Có thể lên tới <span className="num">{formatSalinity(day.riskSalinity)}‰</span>
            {mayExceed && ` · nguy cơ vượt ${SALINITY_THRESHOLD}‰`}
          </span>
        )}
        {model && <span className="text-gray-500">Mô hình: {model}</span>}
      </p>
      {item.silentSince ? (
        <p className="text-sm text-gray-600">
          Trạm mất tín hiệu, số đo cuối {formatMeasuredAt(item.silentSince)}. Không dự báo khi trạm không có số đo mới
          trong 3 ngày, để không lấy số cũ làm dự báo cho những ngày tới.
        </p>
      ) : (
        <div className="h-[180px] rounded-md bg-white p-2">
          <ForecastChart forecasts={forecasts} heightClass="h-full" />
        </div>
      )}
      {accuracy && <StationAccuracy stationId={station.id} seriesLead={accuracy.seriesLead} accuracy={accuracy.station} defaultOpen={compare} />}
    </div>
  );
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
  // Trạm đang mở biểu đồ chi tiết trong lưới (cũng là trạm bản đồ bay tới)
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Trạm mở bằng cột sai số: hiện sẵn phần so với thực tế
  const [compareId, setCompareId] = useState<number | null>(null);
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
      // Trạm mất tín hiệu không dự báo (ml-service cũng từ chối): không lấy lượt dự báo cũ đã lưu
      enabled: isReporting(s.lastMeasuredAt),
      staleTime: 10 * 60_000,
    })),
  });
  const items: StationForecast[] = selected.map((station, i) => {
    const silent = !isReporting(station.lastMeasuredAt);
    return {
      station,
      forecasts: silent ? [] : results[i]?.data ?? [],
      isLoading: !silent && (results[i]?.isLoading ?? true),
      isError: !silent && (results[i]?.isError ?? false),
      silentSince: silent ? station.lastMeasuredAt ?? null : null,
    };
  });

  // Các trạm có thể dùng mô hình khác nhau (ST-GNN chỉ có vài mốc), nên tra theo ngày chứ không theo vị trí
  const dates = [...new Set(items.flatMap((i) => i.forecasts.map((f) => f.forecastDate)))].sort();
  const dayIndex = Math.min(selectedDay, Math.max(0, dates.length - 1));
  const selectedDate = dates[dayIndex];
  const forecastOn = (forecasts: SalinityForecast[], date?: string) => forecasts.find((f) => f.forecastDate === date);
  const { data: modelInfo } = useStgnnModelInfo();
  // Ngày dữ liệu cuối của ST-GNN, khi đã cũ hơn hôm nay
  const dataUntil = items.flatMap((i) => i.forecasts).find((f) => f.dataUntil)?.dataUntil ?? null;
  const insights = buildInsights(items);
  const pending = items.filter((i) => i.isLoading).length;
  // Xếp theo số đo hiện tại: biết ngay từ đầu nên các dòng không nhảy chỗ khi từng dự báo về; trạm mặn nhất lên đầu
  const sortedItems = [...items].sort((a, b) => (b.station.latestSalinity ?? -1) - (a.station.latestSalinity ?? -1));
  // Thẻ điểm ST-GNN chỉ khi có trạm đang hiển thị dự báo của nó (dữ liệu ST-GNN cũ thì ML dùng mô hình khác)
  const { data: accuracy } = useForecastAccuracy();
  const { data: earlyWarning } = useEarlyWarningEvaluation();
  const usesStgnn = items.some((i) => i.forecasts.some((f) => f.modelVersion?.startsWith('st-gnn')));
  // Độ tin cậy toàn vùng ở mốc của chuỗi so sánh (cùng mốc với cột sai số từng trạm)
  const overallSkill = accuracy?.byLead.find((l) => l.lead === accuracy.seriesLead);

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
          <div className="lg:flex-1 min-w-0 p-4 lg:p-5 lg:overflow-y-auto bg-gray-50 flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-lg font-semibold text-gray-900">Dự báo độ mặn {days} ngày tới</h2>
              {pending > 0 && (
                <p className="text-xs text-gray-500 num" role="status">
                  Đang chạy dự báo: {items.length - pending}/{items.length} trạm
                </p>
              )}
            </div>

            {dataUntil && (
              <p className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                Dự báo ST-GNN tính từ dữ liệu ngày <span className="num">{fullDay(dataUntil)}</span> (dữ liệu mới nhất),
                nên các ngày dự báo có thể đã qua. Mô hình chỉ có 2 mốc: sau 1 ngày và sau 7 ngày.
              </p>
            )}

            {/* Kết luận trước, chi tiết sau: trạm vượt hoặc có thể vượt ngưỡng nằm ngay đầu trang */}
            {insights.length > 0 && (
              <section className="card p-4 shrink-0" aria-labelledby="forecast-insights">
                <h3 id="forecast-insights" className="text-sm font-semibold text-gray-900 mb-2">Nhận xét chung</h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5 marker:text-gray-400 text-pretty">
                  {insights.map((text) => <li key={text}>{text}</li>)}
                </ul>
                {accuracy && overallSkill && (
                  <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-600 num text-pretty">
                    So với thực tế: dự báo trước {accuracy.seriesLead} ngày thường sai ±{formatSalinity(overallSkill.mae)}‰,
                    đoán đúng mức mặn {Math.round(overallSkill.levelAccuracy * 100)}% (chạy lại từ {formatDay(accuracy.from)} đến {formatDay(accuracy.to)}).
                    Từng trạm ở cột cuối của bảng.
                  </p>
                )}
              </section>
            )}

            {selected.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-10">Chọn ít nhất một trạm ở bộ lọc bên trái</div>
            ) : (
              <ForecastGrid
                items={sortedItems}
                dates={dates}
                dayIndex={dayIndex}
                onSelectDay={setSelectedDay}
                expandedId={expandedId}
                onToggle={(id) => { setCompareId(null); setExpandedId((prev) => (prev === id ? null : id)); }}
                renderDetail={(item) => (
                  <StationForecastDetail item={item} date={selectedDate} compare={compareId === item.station.id}
                    accuracy={accuracy ? { seriesLead: accuracy.seriesLead, station: accuracy.stations.find((a) => a.stationId === item.station.id) } : null} />
                )}
                skill={accuracy ? {
                  lead: accuracy.seriesLead,
                  of: (id) => accuracy.stations.find((a) => a.stationId === id)?.byLead.find((l) => l.lead === accuracy.seriesLead),
                  onCompare: (id) => { setCompareId(id); setExpandedId(id); },
                } : undefined}
              />
            )}

            {/* Độ tin cậy: cho cán bộ kỹ thuật, gập lại để không chen lên trước dự báo */}
            {(accuracy || (earlyWarning && earlyWarning.seasons.length > 0) || (modelInfo && usesStgnn)) && (
              <details className="shrink-0">
                <summary className="cursor-pointer select-none py-1 text-sm font-semibold text-gray-700 hover:text-gray-900">
                  Độ tin cậy của dự báo
                  <span className="font-normal text-gray-500"> · độ chính xác toàn vùng, cảnh báo sớm các mùa khô</span>
                </summary>
                <div className="mt-3 space-y-4">
                  {modelInfo && usesStgnn && <StgnnScoreCard info={modelInfo} />}
                  {accuracy && <ForecastAccuracyCard accuracy={accuracy} />}
                  {earlyWarning && earlyWarning.seasons.length > 0 && <EarlyWarningCard evaluation={earlyWarning} />}
                </div>
              </details>
            )}
          </div>

          {/* Bản đồ dự báo của ngày đang chọn */}
          <div className="w-full lg:w-[40%] lg:min-w-[320px] h-[480px] lg:h-auto shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Bản đồ dự báo độ mặn {selectedDate ? <span className="num">ngày {dayLabel(selectedDate).label}</span> : ''}
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
                focusId={expandedId}
              />
            </div>
          </div>
        </div>
      }
    />
  );
}
