import React, { useState } from 'react';
import { needsSchedule } from '../api/cropApi';
import { apiErrorMessage } from '../api/client';
import { useCrops } from '../hooks/useCrops';
import { useFields, useRemoveField, useSaveField } from '../hooks/useFields';
import { useMyLocation } from '../hooks/useMyLocation';
import { useStationsList } from '../hooks/useStations';
import { EMPTY_FIELD_FORM, fieldRequest, formFromField, stageText, thresholdText, type FieldForm } from '../utils/fieldForm';
import { formatDistance, nearestStations, type LatLng } from '../utils/geo';
import { formatNumber } from '../utils/salinity';

/**
 * Hồ sơ ruộng: khai một lần cho mỗi ruộng. Lưu ruộng thì app tự theo dõi trạm gần ruộng với ngưỡng theo cây và giai
 * đoạn hiện tại. Vị trí GPS chỉ dùng trên máy để chọn trạm gần nhất, không gửi lên máy chủ.
 */
export function FieldProfileSettings() {
  const { data: fields = [], isLoading } = useFields();
  const { data: crops = [] } = useCrops();
  const { data: stations = [] } = useStationsList();
  const save = useSaveField();
  const remove = useRemoveField();
  const myLocation = useMyLocation();

  /** null: đang đóng form; 'new': khai ruộng mới; số: sửa ruộng đó */
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<FieldForm>(EMPTY_FIELD_FORM);
  const [error, setError] = useState<string | null>(null);
  const [nearestNote, setNearestNote] = useState<string | null>(null);

  const crop = crops.find((c) => c.code === form.cropCode);
  const schedule = crop ? needsSchedule(crop) : false;
  const sortedStations = [...stations].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const set = <K extends keyof FieldForm>(key: K, value: FieldForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const open = (id: number | 'new') => {
    const field = fields.find((f) => f.id === id);
    setForm(field ? formFromField(field) : EMPTY_FIELD_FORM);
    setEditing(id);
    setError(null);
    setNearestNote(null);
  };

  const pickNearest = (from: LatLng) => {
    const nearest = nearestStations(stations.filter((s) => s.status === 'ACTIVE'), from, 1)[0];
    if (!nearest) return;
    set('stationId', nearest.station.id);
    setNearestNote(`Trạm gần bạn nhất, cách ${formatDistance(nearest.km)}`);
  };

  const onPickNearest = () => {
    setError(null);
    // Luôn lấy vị trí mới: người dùng thường đứng ở ruộng khi khai
    myLocation.locate(pickNearest);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = fieldRequest(form, crop);
    if ('error' in result) return setError(result.error);
    try {
      await save.mutateAsync({ id: editing === 'new' ? null : editing, req: result.req });
      setEditing(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được, vui lòng thử lại.'));
    }
  };

  const onRemove = async (id: number, name: string) => {
    if (!window.confirm(`Xoá hồ sơ "${name}"? App sẽ bỏ theo dõi trạm của ruộng này.`)) return;
    setError(null);
    try {
      await remove.mutateAsync(id);
      if (editing === id) setEditing(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không xoá được, vui lòng thử lại.'));
    }
  };

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Hồ sơ ruộng</h2>
        <p className="mt-1 text-sm text-gray-500">
          Khai một lần cho mỗi ruộng hoặc ao. App tự theo dõi trạm gần ruộng với ngưỡng mặn theo cây và giai đoạn hiện tại.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Đang tải...</p>
      ) : fields.length === 0 ? (
        <p className="text-sm text-gray-600">Chưa khai ruộng nào.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border-y border-gray-100">
          {fields.map((f) => {
            const stage = stageText(f);
            const limit = thresholdText(f.threshold, f.minThreshold);
            return (
              <li key={f.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{f.name}</p>
                  <p className="text-xs text-gray-500 num">
                    {[f.cropName + (f.variety ? ` ${f.variety}` : ''), stage, f.areaHa != null ? `${formatNumber(f.areaHa)} ha` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-gray-500 num">
                    {f.stationName == null ? 'Trạm đã bị xoá, hãy chọn lại trạm' : `Trạm ${f.stationName}${limit ? ` · ${limit}` : ''}`}
                  </p>
                  {f.hasPond && (
                    <p className="text-xs text-gray-500 num">
                      Có ao trữ nước ngọt{f.pondVolumeM3 != null ? ` ${formatNumber(f.pondVolumeM3)} m³` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button type="button" onClick={() => open(f.id)} className="text-xs font-medium text-primary hover:underline">
                    Sửa
                  </button>
                  <button type="button" disabled={remove.isPending} onClick={() => void onRemove(f.id, f.name)}
                    className="text-xs font-medium text-gray-500 hover:text-red-700">
                    Xoá
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing == null ? (
        <button type="button" className="btn-secondary" onClick={() => open('new')}>Khai ruộng mới</button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="field-name" className="field-label">Tên ruộng</label>
            <input id="field-name" className="field" maxLength={60} placeholder="vd. Ruộng sau nhà" value={form.name}
              onChange={(e) => set('name', e.target.value)} />
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
              <button type="button" onClick={onPickNearest} disabled={myLocation.status === 'locating'}
                className="font-medium text-primary hover:underline">
                {myLocation.status === 'locating' ? 'Đang lấy vị trí...' : 'Chọn trạm gần tôi nhất'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="field-crop" className="field-label">Cây trồng / vật nuôi</label>
              <select id="field-crop" className="field" value={form.cropCode} onChange={(e) => set('cropCode', e.target.value)}>
                <option value="">Chọn...</option>
                {crops.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="field-variety" className="field-label">Giống</label>
              <input id="field-variety" className="field" maxLength={60} placeholder="vd. OM18" value={form.variety}
                onChange={(e) => set('variety', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="field-planted" className="field-label">{schedule ? 'Ngày gieo sạ' : 'Ngày trồng / thả nuôi'}</label>
              <input id="field-planted" type="date" className="field num" value={form.plantedOn}
                onChange={(e) => set('plantedOn', e.target.value)} />
            </div>
            <div>
              <label htmlFor="field-days" className="field-label">Số ngày của giống</label>
              <input id="field-days" className="field num" inputMode="numeric" placeholder={schedule ? 'vd. 95' : 'Không bắt buộc'}
                value={form.varietyDays} onChange={(e) => set('varietyDays', e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="field-area" className="field-label">Diện tích (ha)</label>
            <input id="field-area" className="field num" inputMode="decimal" placeholder="vd. 1,5" value={form.areaHa}
              onChange={(e) => set('areaHa', e.target.value)} />
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

          <div className="flex gap-3">
            <button type="submit" disabled={save.isPending} className="btn-primary">
              {save.isPending ? 'Đang lưu...' : editing === 'new' ? 'Lưu ruộng' : 'Cập nhật'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Huỷ</button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
    </section>
  );
}
