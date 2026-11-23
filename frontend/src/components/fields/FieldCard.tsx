import type { Crop } from '../../api/cropApi';
import type { FieldProfile } from '../../api/fieldApi';
import type { StationWatch } from '../../api/watchApi';
import { seasonDay, stageSegments } from '../../utils/cropSchedule';
import { thresholdText } from '../../utils/fieldForm';
import { formatDay, formatNumber } from '../../utils/salinity';
import { watchStatus } from '../../utils/watchStatus';
import { CropArt } from './CropArt';
import { StageBar } from './StageBar';

/** Dòng giai đoạn: "Làm đòng – trổ · ngày 41/95", "Gieo ngày 01/12 (còn 8 ngày)", "Đã quá 95 ngày của giống" */
function stageLine(f: FieldProfile, hasBar: boolean): string | null {
  const s = f.stage;
  if (!s) return null;
  if (s.beforePlanting && f.plantedOn) {
    return `Gieo ngày ${formatDay(f.plantedOn)} (còn ${1 - seasonDay(f.plantedOn)} ngày)`;
  }
  if (s.pastHarvest) return `Đã quá ${f.varietyDays} ngày của giống, cập nhật vụ mới khi gieo lại`;
  if (hasBar && s.day != null && f.varietyDays != null) return `${s.name} · ngày ${s.day}/${f.varietyDays}`;
  return s.day != null ? `${s.name} · ngày ${s.day}` : s.name;
}

export function FieldCard({ field: f, crop, watch, onEdit, onRemove, busy }: {
  field: FieldProfile;
  crop: Crop | undefined;
  watch: StationWatch | undefined;
  onEdit: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const segments = crop ? stageSegments(crop, f.varietyDays) : [];
  const status = watch ? watchStatus(watch) : null;
  const limit = thresholdText(f.threshold, f.minThreshold);
  const stage = stageLine(f, segments.length > 0);
  const subtitle = [f.cropName + (f.variety ? ` ${f.variety}` : ''), f.areaHa != null ? `${formatNumber(f.areaHa)} ha` : null]
    .filter(Boolean).join(' · ');

  return (
    <article className="card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <CropArt code={f.cropCode} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{f.name}</h3>
          <p className="text-sm text-gray-500 num truncate">{subtitle}</p>
          {stage && <p className="mt-0.5 text-sm text-gray-700 num">{stage}</p>}
        </div>
      </div>

      {segments.length > 0 && !f.stage?.beforePlanting && (
        <StageBar segments={segments} day={f.stage?.day ?? null} currentCode={f.stage?.pastHarvest ? null : f.stage?.code ?? null} />
      )}

      <div className="space-y-0.5 text-sm">
        {f.stationName == null ? (
          <p className="text-gray-700">Trạm đã bị xoá, bấm Sửa để chọn lại trạm.</p>
        ) : (
          <p className="text-gray-700 num">
            Trạm {f.stationName}
            {limit && <span className="text-gray-500"> · {limit.charAt(0).toUpperCase() + limit.slice(1)}</span>}
          </p>
        )}
        {status && (
          <p className={`num ${status.exceeding ? 'text-red-700 font-medium' : 'text-gray-500'}`}>{status.text}</p>
        )}
        {f.hasPond && (
          <p className="text-gray-500 num">Ao trữ nước ngọt{f.pondVolumeM3 != null ? ` ${formatNumber(f.pondVolumeM3)} m³` : ''}</p>
        )}
      </div>

      <div className="flex gap-4 border-t border-gray-100 pt-2">
        <button type="button" onClick={onEdit} className="text-sm font-medium text-primary hover:underline">Sửa</button>
        <button type="button" disabled={busy} onClick={onRemove} className="text-sm font-medium text-gray-500 hover:text-red-700">Xoá</button>
      </div>
    </article>
  );
}
