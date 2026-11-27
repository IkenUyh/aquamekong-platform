import React, { useState } from 'react';
import { apiErrorMessage } from '../api/client';
import { useMyLocation } from '../hooks/useMyLocation';
import { useStationsList } from '../hooks/useStations';
import { useRemoveWatch, useSaveWatch, useWatches } from '../hooks/useWatches';
import { useCrops } from '../hooks/useCrops';
import { CUSTOM_PRESET, defaultPreset, presetFor, watchPresets } from '../utils/cropThresholds';
import { formatDistance, nearestStations, type LatLng } from '../utils/geo';
import { decimal, thresholdText } from '../utils/fieldForm';
import { formatNumber } from '../utils/salinity';
import { watchStatus } from '../utils/watchStatus';

/**
 * Trạm người dùng theo dõi, mỗi trạm một ngưỡng (gợi ý theo loại cây). Sáng nào số đo hoặc dự báo 7 ngày
 * vượt ngưỡng (hoặc giảm xuống dưới) thì máy chủ gửi thông báo. Đã theo dõi trạm thì chỉ nhận cảnh báo của các trạm đó.
 */
export function StationWatchSettings() {
  const { data: watches = [], isLoading } = useWatches();
  const { data: stations = [] } = useStationsList();
  const save = useSaveWatch();
  const remove = useRemoveWatch();

  const { data: crops = [] } = useCrops();
  const presets = watchPresets(crops);

  const [stationId, setStationId] = useState<number | ''>('');
  /** null = chưa chọn: lấy mức gợi ý đầu tiên của bảng crops */
  const [presetKey, setPresetKey] = useState<string | null>(null);
  /** null = lấy theo mức gợi ý đang chọn; người dùng gõ thì giữ số đã gõ */
  const [thresholdInput, setThresholdInput] = useState<string | null>(null);
  const [minInput, setMinInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearestNote, setNearestNote] = useState<string | null>(null);
  const myLocation = useMyLocation();

  // Theo dõi đặt tay; theo dõi của hồ sơ ruộng sửa ở phần Hồ sơ ruộng
  const manualWatches = watches.filter((w) => w.fieldProfileId == null);
  const existing = manualWatches.find((w) => w.stationId === stationId);
  const sortedStations = [...stations].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const key = presetKey ?? defaultPreset(presets)?.key ?? CUSTOM_PRESET;
  const preset = presets.find((p) => p.key === key);
  const threshold = thresholdInput ?? (preset ? formatNumber(preset.threshold) : '');
  const minText = minInput ?? (preset?.minThreshold != null ? formatNumber(preset.minThreshold) : '');
  // Cận dưới chỉ có nghĩa với mức cần khoảng mặn (nuôi tôm), hoặc khi tự đặt
  const showMin = !preset || preset.minThreshold != null;

  const pickStation = (id: number | '') => {
    setStationId(id);
    // Trạm đã theo dõi: điền sẵn ngưỡng đang dùng để sửa
    const current = manualWatches.find((w) => w.stationId === id);
    if (current) {
      setPresetKey(presetFor(presets, current.crop, current.threshold, current.minThreshold)?.key ?? CUSTOM_PRESET);
      setThresholdInput(formatNumber(current.threshold));
      setMinInput(current.minThreshold == null ? '' : formatNumber(current.minThreshold));
    }
  };

  const pickNearest = (from: LatLng) => {
    const nearest = nearestStations(stations.filter((s) => s.status === 'ACTIVE'), from, 1)[0];
    if (!nearest) return;
    pickStation(nearest.station.id);
    setNearestNote(`Trạm gần bạn nhất, cách ${formatDistance(nearest.km)}`);
  };

  const onPickNearest = () => {
    setError(null);
    if (myLocation.position) pickNearest(myLocation.position);
    else myLocation.locate(pickNearest);
  };

  const pickCrop = (value: string) => {
    setPresetKey(value);
    // Đổi loại cây thì lấy lại ngưỡng của mức mới
    setThresholdInput(null);
    setMinInput(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = decimal(threshold);
    const min = showMin ? decimal(minText) : null;
    if (stationId === '') return setError('Chọn trạm cần theo dõi.');
    if (value == null || !(value > 0 && value <= 40)) return setError('Ngưỡng phải lớn hơn 0 và không quá 40‰.');
    if (min != null && !(min >= 0 && min < value)) return setError('Cận dưới phải nhỏ hơn ngưỡng trên.');
    try {
      await save.mutateAsync({ stationId, threshold: value, minThreshold: min, crop: preset ? preset.crop : null });
      setStationId('');
      setNearestNote(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được, vui lòng thử lại.'));
    }
  };

  const onRemove = async (id: number) => {
    setError(null);
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không bỏ theo dõi được, vui lòng thử lại.'));
    }
  };

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Trạm theo dõi</h2>
        <p className="mt-1 text-sm text-gray-500">
          Chọn trạm gần nơi canh tác và loại cây. Mỗi sáng, nếu số đo hoặc dự báo 7 ngày tới vượt ngưỡng, bạn nhận thông báo để kịp
          trữ nước; khi độ mặn giảm xuống dưới ngưỡng, bạn cũng được báo. Khi đã theo dõi trạm, bạn chỉ nhận cảnh báo của các trạm này.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Đang tải...</p>
      ) : watches.length === 0 ? (
        <p className="text-sm text-gray-600">Chưa theo dõi trạm nào: bạn đang nhận cảnh báo của mọi trạm.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border-y border-gray-100">
          {watches.map((w) => {
            const status = watchStatus(w);
            return (
              <li key={w.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{w.stationName}</p>
                  <p className="text-xs text-gray-500 num">
                    {w.fieldName != null ? `${w.fieldName} · ` : ''}{w.crop ?? 'Tự đặt'} · {thresholdText(w.threshold, w.minThreshold)}
                  </p>
                  <p className={`mt-0.5 text-xs num ${status.exceeding ? 'text-red-700 font-medium' : 'text-gray-500'}`}>{status.text}</p>
                </div>
                {w.fieldProfileId == null ? (
                  <button type="button" disabled={remove.isPending} onClick={() => void onRemove(w.id)}
                    className="text-xs font-medium text-gray-500 hover:text-red-700 shrink-0">
                    Bỏ theo dõi
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 shrink-0">Theo hồ sơ ruộng</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="watch-station" className="field-label">Trạm</label>
          <select id="watch-station" className="field" value={stationId}
            onChange={(e) => { setNearestNote(null); pickStation(e.target.value === '' ? '' : Number(e.target.value)); }}>
            <option value="">Chọn trạm...</option>
            {sortedStations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{manualWatches.some((w) => w.stationId === s.id) ? ' (đang theo dõi)' : ''}</option>
            ))}
          </select>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="text-gray-500 num">
              {myLocation.status === 'denied' ? 'Chưa được phép lấy vị trí, hãy chọn trạm trong danh sách.'
                : myLocation.status === 'unavailable' ? 'Không lấy được vị trí trên thiết bị này.'
                : nearestNote ?? ''}
            </span>
            <button type="button" onClick={onPickNearest} disabled={myLocation.status === 'locating'}
              className="font-medium text-primary hover:underline">
              {myLocation.status === 'locating' ? 'Đang lấy vị trí...' : 'Chọn trạm gần tôi nhất'}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="watch-crop" className="field-label">Loại cây / mục đích</label>
          <select id="watch-crop" className="field" value={key} onChange={(e) => pickCrop(e.target.value)}>
            {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            <option value={CUSTOM_PRESET}>Tự đặt ngưỡng</option>
          </select>
          {preset?.source && (
            <p className="mt-1 text-xs text-gray-400 break-words">
              Nguồn: {preset.source}{preset.note ? ` ${preset.note}` : ''}
            </p>
          )}
        </div>
        <div className={showMin ? 'grid grid-cols-2 gap-3' : ''}>
          {showMin && (
            <div>
              <label htmlFor="watch-min" className="field-label">Cận dưới (‰)</label>
              <input id="watch-min" className="field num" inputMode="decimal" placeholder="Không bắt buộc" value={minText}
                onChange={(e) => setMinInput(e.target.value)} />
            </div>
          )}
          <div>
            <label htmlFor="watch-threshold" className="field-label">{showMin ? 'Ngưỡng trên (‰)' : 'Ngưỡng (‰)'}</label>
            <input id="watch-threshold" className="field num" inputMode="decimal" value={threshold}
              onChange={(e) => setThresholdInput(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={save.isPending} className="btn-primary">
          {save.isPending ? 'Đang lưu...' : existing ? 'Cập nhật ngưỡng' : 'Theo dõi trạm'}
        </button>
      </form>

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
    </section>
  );
}
