import React, { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SalinityForecast, Station } from '../types';
import { classifySalinity, formatDay, formatMeasuredAt, formatSalinity, SALINITY_THRESHOLD } from '../utils/salinity';

export interface StationForecast {
  station: Station;
  forecasts: SalinityForecast[];
  isLoading: boolean;
  isError: boolean;
  /** Trạm mất tín hiệu (utils/salinity isReporting): thời điểm số đo cuối. Không dự báo từ số cũ */
  silentSince: string | null;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()];

/**
 * Chỉ tô nền mức Trung bình và Cao: phần lớn trạm ở mức Thấp, tô cả lưới thì không còn ô nào nổi lên.
 * Giá trị luôn ghi bằng số, màu chỉ nhấn thêm.
 */
const CELL: Record<string, string> = {
  HIGH: 'bg-red-100 font-semibold text-red-900',
  MEDIUM: 'bg-yellow-50 text-gray-900',
  LOW: 'text-gray-700',
  UNKNOWN: 'text-gray-400',
};

/** Độ tin cậy của một trạm: dự báo trước `lead` ngày, chạy lại trên các ngày đã qua rồi so với số đo thật */
export interface StationSkill {
  mae: number;
  levelAccuracy: number;
}

interface ForecastGridProps {
  items: StationForecast[];
  dates: string[];
  dayIndex: number;
  onSelectDay: (index: number) => void;
  expandedId: number | null;
  onToggle: (stationId: number) => void;
  renderDetail: (item: StationForecast) => React.ReactNode;
  /** Có thì thêm cột sai số; bấm vào mở trạm kèm biểu đồ so với thực tế */
  skill?: { lead: number; of: (stationId: number) => StationSkill | undefined; onCompare: (stationId: number) => void };
  /** Quy tắc của mô hình rủi ro: trạm chưa đủ số năm số đo giữ nguyên số mới nhất, ghi nhãn "Trạm mới lắp" */
  modelRule?: {
    fromLead: number; years: number; isNewStation: (stationId: number) => boolean;
    /** Trạm có ST-GNN daily: tới ngày averageFromDay - 1 là số ST-GNN, từ đó trung bình với mô hình rủi ro */
    stgnn?: { stations: number; averageFromDay: number };
  };
}

/**
 * Lưới trạm × ngày dự báo: một dòng mỗi trạm thay cho 40 biểu đồ gần như phẳng, để so được các trạm trên cùng
 * một thang. Bấm tên trạm mở biểu đồ chi tiết ngay dưới dòng; bấm tiêu đề ngày đổi ngày của bản đồ.
 */
export function ForecastGrid({ items, dates, dayIndex, onSelectDay, expandedId, onToggle, renderDetail, skill, modelRule }: ForecastGridProps) {
  const columns = 2 + Math.max(dates.length, 1) + (skill ? 1 : 0);
  // Bề rộng khung nhìn của bảng: phần chi tiết bám mép trái và rộng đúng chừng đó khi bảng cuộn ngang (điện thoại)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState<number>();
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="card overflow-hidden shrink-0">
      <div ref={scrollRef} className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Dự báo độ mặn theo trạm và theo ngày (‰)</caption>
          <thead>
            <tr className="text-xs text-gray-500">
              <th scope="col" className="sticky left-0 z-10 bg-white border-b border-gray-200 px-3 py-2 text-left font-medium">Trạm</th>
              <th scope="col" className="border-b border-gray-200 px-2 py-2 text-right font-medium whitespace-nowrap">Hiện tại</th>
              {dates.map((d, i) => {
                const active = i === dayIndex;
                return (
                  <th key={d} scope="col" className={`border-b px-1 py-1 font-medium ${active ? 'border-primary-500' : 'border-gray-200'}`}>
                    <button type="button" onClick={() => onSelectDay(i)} aria-pressed={active}
                      title="Xem ngày này trên bản đồ"
                      className={`w-full min-w-[46px] rounded-md px-0.5 py-1 leading-tight ${active ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
                      <span className="block font-semibold">{weekday(d)}</span>
                      <span className="block num">{formatDay(d)}</span>
                    </button>
                  </th>
                );
              })}
              {skill && (
                <th scope="col" className="border-b border-gray-200 px-2 py-2 text-right font-medium leading-tight"
                  title={`Dự báo trước ${skill.lead} ngày, chạy lại trên các ngày đã qua, lệch trung bình bao nhiêu so với số đo thật`}>
                  <span className="block whitespace-nowrap">Sai số</span>
                  <span className="block font-normal whitespace-nowrap">trước {skill.lead} ngày</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const { station, forecasts, isLoading, isError, silentSince } = item;
              const expanded = expandedId === station.id;
              const isNew = !silentSince && !!modelRule?.isNewStation(station.id)
                && forecasts.some((f) => f.modelVersion?.startsWith('gb-risk'));
              return (
                <Fragment key={station.id}>
                  <tr className={expanded ? 'bg-primary-50/40' : 'hover:bg-gray-50'}>
                    <th scope="row" className={`sticky left-0 z-10 border-b border-gray-100 px-3 py-2 text-left font-normal ${expanded ? 'bg-primary-50' : 'bg-white'}`}>
                      <button type="button" onClick={() => onToggle(station.id)} aria-expanded={expanded}
                        className="flex w-full min-w-[140px] max-w-[220px] items-start gap-1.5 text-left">
                        {expanded
                          ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                          : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />}
                        <span>
                          <span className="block font-medium text-gray-900 leading-snug">{station.name}</span>
                          {station.province && <span className="block text-xs text-gray-500">{station.province}</span>}
                          {isNew && <span className="block text-xs text-gray-400">Trạm mới lắp</span>}
                        </span>
                      </button>
                    </th>
                    <td className={`border-b border-gray-100 px-2 py-2 text-right num whitespace-nowrap ${silentSince ? 'text-gray-400' : 'text-gray-900'}`}
                      title={silentSince ? `Số đo ${formatMeasuredAt(silentSince)}` : undefined}>
                      {formatSalinity(station.latestSalinity)}
                    </td>
                    {silentSince ? (
                      <td colSpan={Math.max(dates.length, 1)} className="border-b border-gray-100 px-2 py-2 text-xs text-gray-500">
                        Mất tín hiệu, số đo cuối {formatMeasuredAt(silentSince)}: không dự báo
                      </td>
                    ) : isLoading || isError || forecasts.length === 0 ? (
                      <td colSpan={Math.max(dates.length, 1)} className="border-b border-gray-100 px-2 py-2 text-xs text-gray-400">
                        {isLoading
                          ? <span className="block h-3 w-full max-w-xs rounded bg-gray-100" aria-label="Đang chạy dự báo" />
                          : isError ? 'Không lấy được dự báo' : 'Chưa có dự báo'}
                      </td>
                    ) : (
                      dates.map((d) => {
                        const f = forecasts.find((x) => x.forecastDate === d);
                        if (!f) return <td key={d} className="border-b border-gray-100 px-1 py-2 text-center text-gray-300">—</td>;
                        // Mô hình rủi ro: dự báo dưới ngưỡng nhưng "có thể lên tới" trên ngưỡng -> viền đỏ
                        const mayExceed = (f.riskSalinity ?? 0) > SALINITY_THRESHOLD && f.predictedSalinity <= SALINITY_THRESHOLD;
                        const label = `${formatDay(d)}: ${formatSalinity(f.predictedSalinity)}‰`
                          + (f.riskSalinity != null ? `, có thể lên tới ${formatSalinity(f.riskSalinity)}‰` : '');
                        return (
                          <td key={d} className="border-b border-gray-100 px-0.5 py-1.5 text-center">
                            <span title={label}
                              className={`block rounded-md px-1 py-1 num ${CELL[classifySalinity(f.predictedSalinity)]} ${mayExceed ? 'ring-1 ring-inset ring-red-500' : ''}`}>
                              <span className="block">{formatSalinity(f.predictedSalinity)}</span>
                              {/* Mức có thể lên tới (phân vị 80% của mô hình rủi ro): đổi theo từng ngày */}
                              {f.riskSalinity != null && (
                                <span className="block text-[10px] leading-tight font-normal text-gray-500">≤{formatSalinity(f.riskSalinity)}</span>
                              )}
                            </span>
                          </td>
                        );
                      })
                    )}
                    {skill && (() => {
                      const s = skill.of(station.id);
                      return (
                        <td className="border-b border-gray-100 px-2 py-2 text-right whitespace-nowrap">
                          {s ? (
                            <button type="button" onClick={() => { skill.onCompare(station.id); scrollRef.current?.scrollTo({ left: 0 }); }}
                              title={`Thường sai ±${formatSalinity(s.mae)}‰, đúng mức mặn ${Math.round(s.levelAccuracy * 100)}%. Bấm để xem dự báo đặt cạnh số đo thật.`}
                              className="rounded-md px-1.5 py-1 font-medium text-primary hover:bg-primary-50 hover:underline num">
                              ±{formatSalinity(s.mae)}
                            </button>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })()}
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={columns} className="border-b border-gray-200 bg-gray-50 p-0">
                        <div className="sticky left-0" style={{ width: viewWidth }}>{renderDetail(item)}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 px-3 py-2 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-yellow-50 border border-yellow-200" />1 – {SALINITY_THRESHOLD}‰</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-red-100" />trên {SALINITY_THRESHOLD}‰</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded ring-1 ring-inset ring-red-500" />có thể vượt {SALINITY_THRESHOLD}‰</span>
        <span className="flex items-center gap-1.5"><span className="num text-[10px] text-gray-500">≤2,17</span>có thể lên tới</span>
        {modelRule && (
          <span className="text-gray-500">
            Trạm đủ {modelRule.years} năm số đo: từ ngày dự báo thứ {modelRule.fromLead} là số của mô hình; trạm mới lắp giữ nguyên số mới nhất.
          </span>
        )}
        {modelRule?.stgnn && (
          <span className="text-gray-500">
            {modelRule.stgnn.stations} trạm có ST-GNN: ngày 1–{modelRule.stgnn.averageFromDay - 1} là số ST-GNN, ngày {modelRule.stgnn.averageFromDay}–7 trung bình ST-GNN và mô hình rủi ro.
          </span>
        )}
        <span className="text-gray-500">Bấm tên trạm để xem biểu đồ{skill ? ', bấm sai số để so dự báo với số đo thật' : ''}.</span>
      </p>
    </div>
  );
}
