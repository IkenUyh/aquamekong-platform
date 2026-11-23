import React, { useState } from 'react';
import { needsSchedule, type Crop } from '../../api/cropApi';
import { apiErrorMessage } from '../../api/client';
import type { FieldRequest } from '../../api/fieldApi';
import { useMyLocation } from '../../hooks/useMyLocation';
import type { Station } from '../../types';
import { cropStepError, fieldRequest, type FieldForm } from '../../utils/fieldForm';
import { formatDistance, nearestStations, type LatLng } from '../../utils/geo';
import { formatNumber } from '../../utils/salinity';
import { CropArt } from './CropArt';

/** Gợi ý ngắn dưới tên cây trên thẻ chọn: ngưỡng, khoảng mặn, hoặc số giai đoạn */
function cropHint(c: Crop): string {
  const counted = c.stages.filter((s) => s.durationDays != null || s.flexible);
  if (counted.length > 1) return `${counted.length} giai đoạn`;
  const s = c.stages[0];
  if (!s || s.maxSalinity == null) return '';
  return s.minSalinity != null ? `${formatNumber(s.minSalinity)}–${formatNumber(s.maxSalinity)}‰` : `dưới ${formatNumber(s.maxSalinity)}‰`;
}

/**
 * Form khai ruộng theo 2 bước: (1) chọn cây trên lưới thẻ có hình, chọn xong mới hiện ô giống, số ngày và ngày gieo;
 * (2) trạm gần ruộng (GPS chỉ dùng trên máy), diện tích, ao trữ và tên ruộng.
 */
export function FieldWizard({ crops, stations, initial, isNew, saving, onSave, onCancel }: {
  crops: Crop[];
  stations: Station[];
  initial: FieldForm;
  isNew: boolean;
  saving: boolean;
  onSave: (req: FieldRequest) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<FieldForm>(initial);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [nearestNote, setNearestNote] = useState<string | null>(null);
  const myLocation = useMyLocation();

  const crop = crops.find((c) => c.code === form.cropCode);
  const schedule = crop ? needsSchedule(crop) : false;
  const sortedStations = [...stations].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const set = <K extends keyof FieldForm>(key: K, value: FieldForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const next = () => {
    const err = cropStepError(form, crop);
    setError(err);
    if (!err) setStep(2);
  };

  const pickNearest = (from: LatLng) => {
    const nearest = nearestStations(stations.filter((s) => s.status === 'ACTIVE'), from, 1)[0];
    if (!nearest) return;
    set('stationId', nearest.station.id);
    setNearestNote(`Trạm gần bạn nhất, cách ${formatDistance(nearest.km)}`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) return next();
    setError(null);
    const result = fieldRequest(form, crop);
    if ('error' in result) return setError(result.error);
    try {
      await onSave(result.req);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được, vui lòng thử lại.'));
    }
  };

  return (
    <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-gray-900">{isNew ? 'Khai ruộng mới' : 'Sửa hồ sơ ruộng'}</h2>
        <span className="text-xs text-gray-500 num">Bước {step}/2 · {step === 1 ? 'Cây trồng' : 'Vị trí và ruộng'}</span>
      </div>

      {step === 1 ? (
        <>
          <div role="radiogroup" aria-label="Cây trồng / mục đích" className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {crops.map((c) => {
              const selected = c.code === form.cropCode;
              return (
                <button key={c.code} type="button" role="radio" aria-checked={selected}
                  onClick={() => { set('cropCode', c.code); setError(null); }}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                    selected ? 'border-primary ring-1 ring-primary bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}>
                  <CropArt code={c.code} size={48} />
                  <span className="text-xs font-medium text-gray-900 leading-tight">{c.name}</span>
                  <span className="text-[11px] text-gray-500 num leading-tight">{cropHint(c)}</span>
                </button>
              );
            })}
          </div>

          {crop && (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="field-variety" className="field-label">Giống</label>
                  <input id="field-variety" className="field" maxLength={60} placeholder={schedule ? 'vd. OM18' : 'Không bắt buộc'}
                    value={form.variety} onChange={(e) => set('variety', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="field-days" className="field-label">Số ngày của giống</label>
                  <input id="field-days" className="field num" inputMode="numeric" placeholder={schedule ? 'vd. 95' : 'Không bắt buộc'}
                    value={form.varietyDays} onChange={(e) => set('varietyDays', e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="field-planted" className="field-label">{schedule ? 'Ngày gieo sạ' : 'Ngày trồng / thả nuôi'}</label>
                <input id="field-planted" type="date" className="field num" value={form.plantedOn}
                  onChange={(e) => set('plantedOn', e.target.value)} />
                {schedule && (
                  <p className="mt-1 text-xs text-gray-500">App tính giai đoạn {crop.name.toLowerCase()} từ ngày gieo và số ngày của giống.</p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {crop && <CropArt code={crop.code} size={32} />}
            <span>{[crop?.name, form.variety.trim()].filter(Boolean).join(' ')}</span>
            <button type="button" className="ml-auto text-xs font-medium text-primary hover:underline" onClick={() => setStep(1)}>
              Đổi cây
            </button>
          </div>

          <div>
            <label htmlFor="field-station" className="field-label">Trạm gần ruộng</label>
            <select id="field-station" className="field" value={form.stationId}
              onChange={(e) => { setNearestNote(null); set('stationId', e.target.value === '' ? '' : Number(e.target.value)); }}>
              <option value="">Chọn trạm...</option>
              {sortedStations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="text-gray-500 num">
                {myLocation.status === 'denied' ? 'Chưa được phép lấy vị trí, hãy chọn trạm trong danh sách.'
                  : myLocation.status === 'unavailable' ? 'Không lấy được vị trí trên thiết bị này.'
                  : nearestNote ?? 'Đứng ở ruộng và bấm nút để chọn trạm gần nhất. Vị trí không gửi lên máy chủ.'}
              </span>
              <button type="button" onClick={() => { setError(null); myLocation.locate(pickNearest); }}
                disabled={myLocation.status === 'locating'} className="font-medium text-primary hover:underline">
                {myLocation.status === 'locating' ? 'Đang lấy vị trí...' : 'Chọn trạm gần tôi nhất'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="field-name" className="field-label">Tên ruộng</label>
              <input id="field-name" className="field" maxLength={60} placeholder="vd. Ruộng sau nhà" value={form.name}
                onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="field-area" className="field-label">Diện tích (ha)</label>
              <input id="field-area" className="field num" inputMode="decimal" placeholder="vd. 1,5" value={form.areaHa}
                onChange={(e) => set('areaHa', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.hasPond} onChange={(e) => set('hasPond', e.target.checked)} />
              Có ao trữ nước ngọt
            </label>
            {form.hasPond && (
              <div>
                <label htmlFor="field-pond" className="field-label">Dung tích ao (m³)</label>
                <input id="field-pond" className="field num" inputMode="decimal" placeholder="vd. 800" value={form.pondVolumeM3}
                  onChange={(e) => set('pondVolumeM3', e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {step === 1 ? (
          <button type="submit" className="btn-primary" disabled={!crop}>Tiếp</button>
        ) : (
          <>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : isNew ? 'Lưu ruộng' : 'Cập nhật'}</button>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Quay lại</button>
          </>
        )}
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Huỷ</button>}
      </div>
    </form>
  );
}
