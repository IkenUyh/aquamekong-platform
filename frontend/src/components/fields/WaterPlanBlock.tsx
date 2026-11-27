import type { Crop } from '../../api/cropApi';
import type { FieldProfile } from '../../api/fieldApi';
import { useFieldWaterPlan } from '../../hooks/useFields';
import { formatSalinity } from '../../utils/salinity';
import {
  chipDay, planSummary, storageLines, storageNote, strongestMixLine, WATER_DAY_CHIP, waterDayLabel,
} from '../../utils/waterPlan';
import { Disclaimer } from '../Disclaimer';

/**
 * Kế hoạch nước 7 ngày tới của một ruộng: mỗi ngày một ô màu (lấy được nước sông / có thể mặn / mặn / chưa biết)
 * với độ mặn cao nhất ngày đó, một câu tóm tắt, tỷ lệ pha ngày mặn nhất và ao đủ bao lâu.
 * Không hiện gì khi backend không tính được (ruộng không có trạm, giai đoạn không có ngưỡng).
 */
export function WaterPlanBlock({ field, crop, className = '' }: {
  field: FieldProfile;
  crop: Crop | undefined;
  className?: string;
}) {
  const { data: plan, isLoading, isError } = useFieldWaterPlan(field.stationId == null ? null : field.id);
  if (field.stationId == null || isError || (!isLoading && !plan)) return null;
  if (isLoading || !plan) return <p className={`text-sm text-gray-400 ${className}`}>Đang lập kế hoạch nước...</p>;

  const aquaculture = crop?.category === 'AQUACULTURE';
  const mix = aquaculture ? null : strongestMixLine(plan.days);
  const anyUnsafe = plan.days.some((d) => d.status === 'EXCEED' || d.status === 'RISK');
  const storage = plan.storage;

  return (
    <div className={`space-y-2 text-sm ${className}`}>
      <h4 className="font-semibold text-gray-800">Kế hoạch nước 7 ngày tới</h4>
      <ol className="grid grid-cols-4 gap-1 sm:grid-cols-8">
        {plan.days.map((d, i) => (
          <li key={d.date} title={waterDayLabel(d.status, aquaculture)}
            className={`rounded-md border px-1 py-1 text-center leading-tight ${WATER_DAY_CHIP[d.status]}`}>
            <span className="block text-[11px]">{chipDay(d, i)}</span>
            <span className="block text-xs font-medium num">
              {d.salinity == null ? '—' : `${formatSalinity(d.salinity)}‰`}
            </span>
            {d.status === 'RISK' && d.riskSalinity != null && (
              <span className="block text-[10px] num">≤{formatSalinity(d.riskSalinity)}</span>
            )}
            {d.measured && <span className="block text-[10px]">số đo</span>}
          </li>
        ))}
      </ol>
      <Legend aquaculture={aquaculture} />

      <p className={`num ${anyUnsafe ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{planSummary(plan, aquaculture)}</p>
      {mix && (
        <div className="space-y-0.5">
          <p className="text-gray-700 num">{mix}.</p>
          <p className="text-xs text-gray-400">
            Tỷ lệ tính với nước ao ngọt ({formatSalinity(plan.pondSalinityAssumed)}‰), làm tròn để nhiều nước ao hơn.
            Ao đã nhiễm mặn thì phải pha nhiều nước ao hơn nữa.
          </p>
        </div>
      )}

      {storage && (
        <div className="space-y-0.5 border-t border-gray-100 pt-2">
          {storageLines(storage).map((line) => <p key={line} className="text-gray-700 num">{line}.</p>)}
          <p className="text-xs text-gray-400" title={[storage.kcSource, storage.et0Source].filter(Boolean).join('\n')}>
            {storageNote(storage, field.cropCode === 'lua')}
          </p>
        </div>
      )}
      <Disclaimer />
    </div>
  );
}

function Legend({ aquaculture }: { aquaculture: boolean }) {
  const items = (['SAFE', 'RISK', 'EXCEED', 'UNKNOWN'] as const).map((s) => (
    <span key={s} className="flex items-center gap-1">
      <span className={`h-2.5 w-3.5 rounded-sm border ${WATER_DAY_CHIP[s]}`} aria-hidden="true" />
      {waterDayLabel(s, aquaculture)}
    </span>
  ));
  return <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">{items}</div>;
}
