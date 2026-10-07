import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Navbar } from '../components/Navbar';
import { BottomNav } from '../components/BottomNav';
import { MetricCard } from '../components/MetricCard';
import { StationsMiniMap } from '../components/shared/StationsMiniMap';
import { useReplay, useReplayBounds } from '../hooks/useReplay';
import { dryseasonPresets, type Replay, type ReplayEvent } from '../api/replayApi';
import { formatNumber, SALINITY_CLASS_COLORS } from '../utils/salinity';

/** Số ngày phát mỗi giây */
const SPEEDS = [1, 2, 5, 10];
/** Nhật ký chỉ hiện các sự kiện gần nhất */
const LOG_LIMIT = 100;

function formatDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-');
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

interface LoggedEvent extends ReplayEvent {
  date: string;
  stationName: string;
}

function EventLog({ events }: { events: LoggedEvent[] }) {
  if (events.length === 0) {
    return <p className="mt-3 text-sm text-gray-500">Chưa có cảnh báo nào tới ngày này.</p>;
  }
  return (
    <ul className="mt-2 divide-y divide-gray-100 overflow-y-auto max-h-[372px] pr-1">
      {events.map((e, i) => {
        const opened = e.type === 'OPENED';
        return (
          <li key={`${e.date}-${e.stationId}-${i}`} className="py-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className="dot" style={{ backgroundColor: SALINITY_CLASS_COLORS[opened ? 'HIGH' : 'LOW'] }} />
                <span className="truncate text-gray-900">{e.stationName}</span>
              </span>
              <span className="text-xs text-gray-500 num shrink-0">{formatDate(e.date, false)}</span>
            </div>
            <div className={`ml-4 text-xs ${opened ? 'text-red-700' : 'text-green-700'}`}>
              {opened ? 'Vượt ngưỡng' : 'Về dưới ngưỡng'} · <span className="num">{formatNumber(e.value)}‰</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Player({ replay }: { replay: Replay }) {
  const { stations, days } = replay;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const last = days.length - 1;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i >= last) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, last]);

  const togglePlay = () => {
    if (!playing && index >= last) setIndex(0);
    setPlaying((p) => !p);
  };

  const day = days[Math.min(index, last)];
  const nameById = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);

  // Nhật ký: mọi sự kiện từ đầu tới ngày đang xem, mới nhất trước
  const log = useMemo(() => {
    const out: LoggedEvent[] = [];
    for (let i = Math.min(index, last); i >= 0 && out.length < LOG_LIMIT; i--) {
      for (const e of days[i].events) out.push({ ...e, date: days[i].date, stationName: nameById.get(e.stationId) ?? '' });
    }
    return out.slice(0, LOG_LIMIT);
  }, [days, index, last, nameById]);

  const peak = useMemo(() => {
    let best: { name: string; value: number } | null = null;
    day.salinity.forEach((v, i) => {
      if (v != null && (best == null || v > best.value)) best = { name: stations[i].name, value: v };
    });
    return best as { name: string; value: number } | null;
  }, [day, stations]);

  const chartData = useMemo(
    () => days.map((d, i) => ({ i, label: formatDate(d.date, false), above: d.aboveCount })),
    [days],
  );
  const opened = day.events.filter((e) => e.type === 'OPENED').length;
  const reporting = day.salinity.filter((v) => v != null).length;

  return (
    <>
      {/* Điều khiển phát */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary min-w-28 whitespace-nowrap" onClick={togglePlay}>
            {playing ? 'Tạm dừng' : index >= last ? 'Phát lại' : 'Phát'}
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Tốc độ
            <select className="field w-auto py-1.5" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((s) => <option key={s} value={s}>{s} ngày/giây</option>)}
            </select>
          </label>
          <div className="ml-auto text-right">
            <div className="text-2xl font-semibold text-gray-900 num">{formatDate(day.date)}</div>
            <div className="text-xs text-gray-500 num">Ngày {index + 1} / {days.length}</div>
          </div>
        </div>
        <input
          type="range" min={0} max={last} value={index}
          onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
          className="mt-4 w-full accent-primary"
          aria-label="Chọn ngày"
        />
        <div className="flex justify-between text-xs text-gray-500 num">
          <span>{formatDate(replay.from)}</span>
          <span>{formatDate(replay.to)}</span>
        </div>
      </section>

      {/* Chỉ số trong ngày */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Trạm vượt ngưỡng trong ngày"
          value={`${day.aboveCount} / ${reporting}`}
          tone={day.aboveCount > 0 ? 'danger' : 'default'}
          hint="trên số trạm có số đo hôm đó"
        />
        <MetricCard label="Cảnh báo đang mở" value={day.openCount} tone={day.openCount > 0 ? 'danger' : 'default'} hint="tính tới cuối ngày" />
        <MetricCard label="Cảnh báo mới trong ngày" value={opened} hint={opened > 0 ? undefined : 'không có trạm mới vượt ngưỡng'} />
        <MetricCard
          label="Độ mặn cao nhất"
          value={formatNumber(peak?.value)}
          unit={peak ? '‰' : undefined}
          hint={peak?.name ?? 'không có số đo'}
        />
      </div>

      {/* Bản đồ + nhật ký */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card overflow-hidden lg:col-span-2 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Độ mặn lớn nhất trong ngày tại các trạm</h2>
          </div>
          <div className="h-[420px]">
            <StationsMiniMap
              stations={stations.map((s, i) => ({ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude, salinity: day.salinity[i] }))}
            />
          </div>
        </section>
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-gray-900">Nhật ký cảnh báo</h2>
          <EventLog events={log} />
        </section>
      </div>

      {/* Diễn biến cả giai đoạn */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Số trạm vượt ngưỡng theo ngày</h2>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              onClick={(e) => { if (e?.activeTooltipIndex != null) { setPlaying(false); setIndex(e.activeTooltipIndex); } }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [v, 'Trạm vượt ngưỡng']} />
              <Area type="monotone" dataKey="above" stroke={SALINITY_CLASS_COLORS.HIGH} fill={SALINITY_CLASS_COLORS.HIGH} fillOpacity={0.15} isAnimationActive={false} />
              <ReferenceLine x={chartData[index]?.label} stroke="#0F3D5E" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-gray-500">Bấm vào biểu đồ để nhảy tới ngày đó.</p>
      </section>
    </>
  );
}

export function ReplayPage() {
  const { data: bounds, isLoading: loadingBounds } = useReplayBounds();
  const presets = useMemo(() => (bounds ? dryseasonPresets(bounds) : []), [bounds]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // Mặc định: mùa khô gần nhất có dữ liệu
  useEffect(() => {
    if (!range && presets.length > 0) {
      setRange(presets[0]);
      setDraft(presets[0]);
    }
  }, [presets, range]);

  const { data: replay, isLoading, error } = useReplay(range?.from, range?.to);
  const presetValue = presets.find((p) => p.from === range?.from && p.to === range?.to)?.label ?? '';
  const draftInvalid = !draft.from || !draft.to || draft.from > draft.to;

  return (
    <div className="flex flex-col h-dvh w-screen bg-[var(--color-bg)]">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full p-4 lg:p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Phát lại lịch sử</h1>
            <p className="mt-1 text-sm text-gray-500">
              Xem lại mặn lan theo từng ngày từ số đo quan trắc. Cảnh báo được tính lại theo ngưỡng rule hiện tại của từng trạm, không ghi vào hệ thống.
            </p>
          </div>

          {/* Chọn giai đoạn */}
          <section className="card p-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="replay-preset" className="field-label">Giai đoạn</label>
              <select
                id="replay-preset" className="field w-56" value={presetValue}
                onChange={(e) => {
                  const p = presets.find((x) => x.label === e.target.value);
                  if (p) { setRange(p); setDraft(p); }
                }}
              >
                {presetValue === '' && <option value="">Tuỳ chọn</option>}
                {presets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="replay-from" className="field-label">Từ ngày</label>
              <input id="replay-from" type="date" className="field w-40" value={draft.from}
                min={bounds?.minDate ?? undefined} max={bounds?.maxDate ?? undefined}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="replay-to" className="field-label">Đến ngày</label>
              <input id="replay-to" type="date" className="field w-40" value={draft.to}
                min={bounds?.minDate ?? undefined} max={bounds?.maxDate ?? undefined}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
            </div>
            <button type="button" className="btn-secondary" disabled={draftInvalid} onClick={() => setRange(draft)}>
              Xem giai đoạn này
            </button>
            {bounds?.minDate && bounds.maxDate && (
              <p className="w-full text-xs text-gray-500 num">
                Dữ liệu có từ {formatDate(bounds.minDate)} đến {formatDate(bounds.maxDate)}; mỗi lần xem tối đa 366 ngày.
              </p>
            )}
          </section>

          {loadingBounds || isLoading ? (
            <div className="card p-8 text-center text-sm text-gray-500">Đang tải dữ liệu...</div>
          ) : error ? (
            <div className="card p-8 text-center text-sm text-red-700">
              {(error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Không tải được dữ liệu phát lại.'}
            </div>
          ) : !replay || replay.days.length === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-500">Chưa có dữ liệu độ mặn để phát lại.</div>
          ) : (
            // key: đổi giai đoạn thì về ngày đầu, dừng phát
            <Player key={`${replay.from}-${replay.to}`} replay={replay} />
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
