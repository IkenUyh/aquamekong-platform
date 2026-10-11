import React, { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useReplay, useReplayBounds } from '../hooks/useReplay';
import { formatDay, formatSalinity, SALINITY_THRESHOLD } from '../utils/salinity';

/** Trục Y hai biểu đồ cùng bề rộng để các ngày thẳng cột với nhau */
const Y_WIDTH = 36;
const AXIS_TICK = { fill: '#6b7280', fontSize: 11 };

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Ngày YYYY-MM-DD lùi n ngày (tính theo lịch, không lệch múi giờ) */
function minusDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - n));
  return date.toISOString().slice(0, 10);
}

/**
 * Diễn biến theo ngày từ số đo từng trạm (API phát lại), thay cho đường trung bình toàn vùng vốn gần như đứng yên:
 * số trạm vượt ngưỡng, rồi độ mặn cao nhất và trung vị. Hai biểu đồ riêng, chung trục ngày (không dùng hai trục Y).
 */
export function DailySalinityChart({ days }: { days: number }) {
  const { data: bounds } = useReplayBounds();
  const to = bounds?.maxDate ?? undefined;
  const from = to ? minusDays(to, days - 1) : undefined;
  const { data: replay, isLoading } = useReplay(from, to);

  const series = useMemo(() => (replay?.days ?? []).map((day) => {
    const measured = day.salinity
      .map((v, i) => ({ v, i }))
      .filter((x): x is { v: number; i: number } => x.v != null);
    const top = measured.reduce<{ v: number; i: number } | null>((a, b) => (a == null || b.v > a.v ? b : a), null);
    return {
      label: formatDay(day.date),
      above: day.aboveCount,
      max: top?.v ?? null,
      maxStation: top ? replay!.stations[top.i]?.name : undefined,
      median: median(measured.map((x) => x.v)),
    };
  }), [replay]);

  const peak = series.reduce<(typeof series)[number] | null>((a, b) => (b.max != null && (a?.max == null || b.max > a.max) ? b : a), null);
  const daysAbove = series.filter((s) => s.above > 0).length;
  const last = [...series].reverse().find((s) => s.median != null);

  return (
    <section className="card p-5" aria-labelledby="daily-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="daily-title" className="font-semibold text-gray-900">Diễn biến theo ngày</h3>
        {from && to && <p className="text-xs text-gray-500 num">Số đo từng trạm, {formatDay(from)} – {formatDay(to)}</p>}
      </div>

      {isLoading || !replay ? (
        <div className="mt-4 h-[330px] rounded-md bg-gray-50" aria-label="Đang tải số đo theo ngày" />
      ) : series.length === 0 ? (
        <p className="mt-4 py-16 text-center text-sm text-gray-500">Chưa có số đo trong kỳ</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-gray-600 text-pretty">
            {daysAbove > 0
              ? <>Có trạm vượt ngưỡng <span className="num font-medium text-gray-900">{daysAbove}/{series.length}</span> ngày.</>
              : <>Không ngày nào có trạm vượt ngưỡng {SALINITY_THRESHOLD}‰.</>}
            {peak?.max != null && (
              <> Cao nhất <span className="num font-medium text-gray-900">{formatSalinity(peak.max)}‰</span> tại {peak.maxStation} ngày <span className="num">{peak.label}</span>.</>
            )}
            {/* Trung vị thường sát 0 trên thang của mức cao nhất, nên ghi bằng số */}
            {last?.median != null && (
              <> Trung vị các trạm ngày <span className="num">{last.label}</span> là <span className="num font-medium text-gray-900">{formatSalinity(last.median)}‰</span>.</>
            )}
          </p>

          <p className="mt-4 text-xs font-medium text-gray-600">Số trạm vượt ngưỡng {SALINITY_THRESHOLD}‰</p>
          <div className="h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" hide />
                <YAxis width={Y_WIDTH} tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v: number) => [`${v} trạm`, 'Vượt ngưỡng']} />
                <Bar dataKey="above" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-xs font-medium text-gray-600">Độ mặn các trạm (‰)</p>
            <div className="flex gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" />Cao nhất</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-gray-400" />Trung vị</span>
              <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-red-500" />Ngưỡng {SALINITY_THRESHOLD}‰</span>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis width={Y_WIDTH} tick={AXIS_TICK} axisLine={false} tickLine={false}
                  domain={[0, (max: number) => Math.ceil(Math.max(max, SALINITY_THRESHOLD) * 1.1)]} />
                <Tooltip
                  formatter={(v: number, name: string) => [`${formatSalinity(v)}‰`, name]}
                  labelFormatter={(label: string, payload) => {
                    const station = payload?.[0]?.payload?.maxStation;
                    return station ? `${label} · cao nhất tại ${station}` : label;
                  }}
                />
                <ReferenceLine y={SALINITY_THRESHOLD} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="max" name="Cao nhất" stroke="#0F3D5E" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="median" name="Trung vị" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
