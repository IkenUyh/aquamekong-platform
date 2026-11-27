import type { FieldProfile } from '../../api/fieldApi';
import { useFieldPlan } from '../../hooks/useFields';
import { groupByDay, PRIORITY_DOT, VERDICT } from '../../utils/actionPlan';
import { StatusBadge } from '../shared/StatusBadge';

/**
 * Việc cần làm tuần này của một ruộng: câu trả lời "Tuần này lấy nước được không?" (verdict) và các việc có ngày
 * (trữ trước ngày mặn, pha nước ao, ngừng lấy nước sông...), gom theo ngày bắt đầu. Đặt trên WaterPlanBlock, khối đó
 * có ô từng ngày và lời nhắc tham khảo. Không hiện gì khi backend không lập được kế hoạch.
 */
export function ActionPlanBlock({ field, className = '' }: { field: FieldProfile; className?: string }) {
  const { data: plan, isLoading, isError } = useFieldPlan(field.stationId == null ? null : field.id);
  if (field.stationId == null || isError || (!isLoading && !plan)) return null;
  if (isLoading || !plan) return <p className={`text-sm text-gray-400 ${className}`}>Đang lập việc cần làm...</p>;

  const verdict = VERDICT[plan.verdict] ?? VERDICT.GREY;
  const { groups, takeWater } = groupByDay(plan);

  return (
    <div className={`space-y-2 text-sm ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-gray-800">Việc cần làm tuần này</h4>
        <StatusBadge level={verdict.level} text={verdict.label} />
      </div>
      <p className="font-medium text-gray-900 num">{plan.headline}</p>

      {groups.length > 0 && (
        <ol className="space-y-1.5">
          {groups.map((g) => (
            <li key={g.date} className="flex items-start gap-2">
              <span className={`mt-0.5 w-16 shrink-0 rounded-md border px-1 py-0.5 text-center text-[11px] leading-tight ${g.chip}`}>
                {g.label}
              </span>
              <ul className="min-w-0 flex-1 space-y-0.5">
                {g.actions.map((a) => (
                  <li key={`${a.kind}-${a.from}-${a.source}`} className="flex items-start gap-1.5 text-gray-800 num">
                    <span className={`dot mt-1.5 shrink-0 ${PRIORITY_DOT[a.priority] ?? PRIORITY_DOT.LOW}`} aria-hidden="true" />
                    <span>{a.message}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {takeWater && <p className="text-gray-600 num">{takeWater.message}.</p>}
    </div>
  );
}
