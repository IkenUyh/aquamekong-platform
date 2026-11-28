import React, { useState } from 'react';
import { fixedDays, needsSchedule, type Crop } from '../../api/cropApi';
import type { FieldProfile } from '../../api/fieldApi';
import { useMyLocation } from '../../hooks/useMyLocation';
import { isNativeApp } from '../../platform';
import type { Station } from '../../types';
import { BIG_BUTTON, farmerScheduleError, VARIETY_DAY_CHIPS, type FarmerChoice } from '../../utils/farmerMode';
import { formatDistance, nearestStations } from '../../utils/geo';
import {
  classifySalinity, formatNumber, isReporting, SALINITY_CLASS_COLORS, SALINITY_CLASS_SHORT_LABELS,
} from '../../utils/salinity';
import { CropImage } from '../fields/CropImage';

type Step = 'station' | 'crop' | 'schedule';

const DENIED_HINT = isNativeApp
  ? 'App chưa được phép lấy vị trí. Mở Cài đặt điện thoại → Ứng dụng → AquaMekong → Quyền → Vị trí. Hoặc chọn trạm trong danh sách dưới đây.'
  : 'Trang chưa được phép lấy vị trí. Bấm ổ khoá cạnh địa chỉ trang → Vị trí → Cho phép. Hoặc chọn trạm trong danh sách dưới đây.';

const shortCropName = (name: string) => {
  const s = name.replace(/^Nuôi /, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function StepTitle({ n, total, children }: { n: number; total: number; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-lg text-gray-600 num">Bước {n}/{total}</p>
      <h2 className="text-2xl font-bold text-gray-900">{children}</h2>
    </div>
  );
}

/** Một trạm dạng nút lớn: tên, khoảng cách, độ mặn mới nhất (chấm màu + chữ) */
function StationButton({ station, km, selected, onClick }: {
  station: Station; km?: number; selected: boolean; onClick: () => void;
}) {
  const reporting = isReporting(station.lastMeasuredAt);
  const level = classifySalinity(reporting ? station.latestSalinity : null);
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`w-full rounded-xl border-2 bg-white px-4 py-3 text-left text-lg ${
        selected ? 'border-primary ring-2 ring-primary' : 'border-gray-300 hover:border-primary-300'}`}>
      <span className="block text-xl font-semibold text-gray-900">{station.name}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-700 num">
        {km != null && <span>cách {formatDistance(km)}</span>}
        {reporting && station.latestSalinity != null ? (
          <span className="inline-flex items-center gap-2">
            <span className="dot" style={{ backgroundColor: SALINITY_CLASS_COLORS[level] }} aria-hidden="true" />
            {formatNumber(station.latestSalinity)}‰ · {SALINITY_CLASS_SHORT_LABELS[level]}
          </span>
        ) : (
          <span>{station.lastMeasuredAt ? 'mất tín hiệu' : 'chưa có số đo'}</span>
        )}
      </span>
    </button>
  );
}

/**
 * Cài đặt một lần của chế độ Nông dân: (1) trạm gần tôi (GPS chỉ dùng trên máy) hoặc chọn trong danh sách, (2) cây
 * trồng bằng ô ảnh lớn, (3) chỉ với lúa: ngày gieo và số ngày của giống. Người có ruộng đã khai chọn luôn ruộng đó.
 */
export function FarmerSetup({ stations, crops, fields, initial, onDone, onCancel }: {
  stations: Station[];
  crops: Crop[];
  /** Ruộng tài khoản đang xem đã khai (có trạm) */
  fields: FieldProfile[];
  initial: FarmerChoice | null;
  onDone: (choice: FarmerChoice) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<Step>('station');
  const [stationId, setStationId] = useState<number | null>(initial?.fieldId ? null : initial?.stationId ?? null);
  const [cropCode, setCropCode] = useState<string | null>(initial?.fieldId ? null : initial?.cropCode ?? null);
  const [plantedOn, setPlantedOn] = useState(initial?.plantedOn ?? '');
  const [days, setDays] = useState<number | null>(initial?.varietyDays ?? null);
  const [customDays, setCustomDays] = useState(
    initial?.varietyDays != null && !VARIETY_DAY_CHIPS.includes(initial.varietyDays) ? String(initial.varietyDays) : '');
  const [showList, setShowList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { position, status, locate } = useMyLocation();

  const active = stations.filter((s) => s.status === 'ACTIVE');
  const nearby = position ? nearestStations(active, position, 3) : [];
  const sorted = [...active].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const current = stationId == null ? undefined : stations.find((s) => s.id === stationId);
  const crop = crops.find((c) => c.code === cropCode);
  const total = crop && needsSchedule(crop) ? 3 : 2;

  const pickStation = (id: number) => {
    setStationId(id);
    setStep('crop');
  };

  const pickCrop = (c: Crop) => {
    setCropCode(c.code);
    setError(null);
    if (needsSchedule(c)) setStep('schedule');
    else if (stationId != null) onDone({ stationId, cropCode: c.code });
  };

  const finishSchedule = () => {
    if (!crop || stationId == null) return;
    const err = farmerScheduleError(plantedOn, days, fixedDays(crop));
    setError(err);
    if (!err && days != null) onDone({ stationId, cropCode: crop.code, plantedOn, varietyDays: days });
  };

  if (step === 'crop') {
    return (
      <section className="space-y-4">
        <StepTitle n={2} total={total}>Bạn trồng / nuôi gì?</StepTitle>
        <div role="radiogroup" aria-label="Cây trồng / vật nuôi" className="grid grid-cols-2 gap-3">
          {crops.map((c) => {
            const selected = c.code === cropCode;
            return (
              <button key={c.code} type="button" role="radio" aria-checked={selected} onClick={() => pickCrop(c)}
                className={`flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left ${
                  selected ? 'border-primary ring-2 ring-primary' : 'border-gray-300 hover:border-primary-300'}`}>
                <CropImage code={c.code} name={c.name} className="aspect-[4/3] w-full text-3xl" />
                <span className="px-3 py-2 text-lg font-semibold leading-snug text-gray-900">{shortCropName(c.name)}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setStep('station')} className={`${BIG_BUTTON} w-full border-2 border-gray-300 bg-white text-gray-800`}>
          Quay lại chọn trạm
        </button>
      </section>
    );
  }

  if (step === 'schedule' && crop) {
    const fixed = fixedDays(crop);
    return (
      <section className="space-y-5">
        <StepTitle n={3} total={3}>{shortCropName(crop.name)} gieo ngày nào?</StepTitle>
        <div>
          <label htmlFor="farmer-planted" className="block text-lg font-semibold text-gray-900">Ngày gieo sạ</label>
          <input id="farmer-planted" type="date" value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)}
            className="mt-2 w-full min-h-12 rounded-xl border-2 border-gray-300 bg-white px-4 text-lg text-gray-900 num focus:border-primary focus:outline-none" />
        </div>
        <fieldset>
          <legend className="text-lg font-semibold text-gray-900">Giống bao nhiêu ngày?</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {VARIETY_DAY_CHIPS.filter((d) => d > fixed).map((d) => (
              <button key={d} type="button" aria-pressed={days === d && customDays === ''}
                onClick={() => { setDays(d); setCustomDays(''); setError(null); }}
                className={`${BIG_BUTTON} border-2 num ${days === d && customDays === ''
                  ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-900'}`}>
                {d} ngày
              </button>
            ))}
          </div>
          <label htmlFor="farmer-days" className="mt-3 block text-lg text-gray-700">Hoặc nhập số ngày khác</label>
          <input id="farmer-days" inputMode="numeric" placeholder={`lớn hơn ${fixed}`} value={customDays}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setCustomDays(v);
              setDays(v === '' ? null : Number(v));
              setError(null);
            }}
            className="mt-2 w-full min-h-12 rounded-xl border-2 border-gray-300 bg-white px-4 text-lg text-gray-900 num focus:border-primary focus:outline-none" />
        </fieldset>
        {error && <p role="alert" className="text-lg font-medium text-red-700">{error}</p>}
        <div className="grid gap-3">
          <button type="button" onClick={finishSchedule} className={`${BIG_BUTTON} bg-primary text-white`}>Xem kết quả</button>
          <button type="button" onClick={() => setStep('crop')} className={`${BIG_BUTTON} border-2 border-gray-300 bg-white text-gray-800`}>
            Quay lại chọn cây
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {fields.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-900">Dùng ruộng đã khai</h2>
          <p className="text-lg text-gray-700">Có ao và diện tích nên biết thêm tỷ lệ pha nước ao.</p>
          {fields.map((f) => (
            <button key={f.id} type="button" aria-pressed={initial?.fieldId === f.id}
              onClick={() => onDone({
                fieldId: f.id, stationId: f.stationId as number, cropCode: f.cropCode,
                ...(f.plantedOn ? { plantedOn: f.plantedOn } : {}), ...(f.varietyDays ? { varietyDays: f.varietyDays } : {}),
              })}
              className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white p-3 text-left ${
                initial?.fieldId === f.id ? 'border-primary ring-2 ring-primary' : 'border-gray-300 hover:border-primary-300'}`}>
              <CropImage code={f.cropCode} name={f.cropName} className="h-14 w-14 shrink-0 rounded-lg" />
              <span className="min-w-0">
                <span className="block text-xl font-semibold text-gray-900">{f.name}</span>
                <span className="block text-lg text-gray-700">{f.cropName} · trạm {f.stationName}</span>
              </span>
            </button>
          ))}
          <p className="pt-2 text-lg text-gray-700">Hoặc chọn trạm và cây:</p>
        </div>
      )}

      <StepTitle n={1} total={total}>Trạm gần bạn</StepTitle>
      <p className="text-lg text-gray-700">Vị trí chỉ dùng trên máy này để tìm trạm, không gửi lên máy chủ.</p>

      {current && (
        <div className="space-y-2">
          <p className="text-lg text-gray-700">Trạm đang chọn:</p>
          <StationButton station={current} selected onClick={() => pickStation(current.id)} />
        </div>
      )}

      <button type="button" onClick={() => locate()} disabled={status === 'locating'}
        className={`${BIG_BUTTON} w-full bg-primary text-white disabled:opacity-60`}>
        {status === 'locating' ? 'Đang tìm vị trí...' : status === 'ready' ? 'Tìm lại trạm gần tôi' : 'Tìm trạm gần tôi'}
      </button>

      {(status === 'denied' || status === 'unavailable') && (
        <p role="alert" className="text-lg text-gray-800">
          {status === 'denied' ? DENIED_HINT : 'Không lấy được vị trí trên máy này. Chọn trạm trong danh sách dưới đây.'}
        </p>
      )}

      {status === 'ready' && nearby.length > 0 && (
        <ul className="space-y-3">
          {nearby.map(({ station, km }) => (
            <li key={station.id}>
              <StationButton station={station} km={km} selected={station.id === stationId} onClick={() => pickStation(station.id)} />
            </li>
          ))}
        </ul>
      )}

      {showList || status === 'denied' || status === 'unavailable' ? (
        <div>
          <label htmlFor="farmer-station" className="block text-lg font-semibold text-gray-900">Chọn trạm trong danh sách</label>
          <select id="farmer-station" value={stationId ?? ''}
            onChange={(e) => { if (e.target.value) pickStation(Number(e.target.value)); }}
            className="mt-2 w-full min-h-12 rounded-xl border-2 border-gray-300 bg-white px-3 text-lg text-gray-900 focus:border-primary focus:outline-none">
            <option value="">-- Chọn trạm --</option>
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.province ? ` (${s.province})` : ''}</option>
            ))}
          </select>
        </div>
      ) : (
        <button type="button" onClick={() => setShowList(true)}
          className={`${BIG_BUTTON} w-full border-2 border-gray-300 bg-white text-gray-800`}>
          Chọn trạm trong danh sách
        </button>
      )}

      {onCancel && (
        <button type="button" onClick={onCancel} className={`${BIG_BUTTON} w-full text-primary underline`}>
          Thôi, giữ như cũ
        </button>
      )}
    </section>
  );
}
