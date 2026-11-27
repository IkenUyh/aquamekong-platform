import type { FieldPlan, PlanAction, PlanVerdict, WaterDay } from '../api/fieldApi';
import type { RecommendationDto } from '../api/recommendationApi';
import type { StatusLevel } from '../components/shared/StatusBadge';
import { formatDay } from './salinity';
import { WATER_DAY_CHIP } from './waterPlan';

/**
 * Lời và màu cho kế hoạch việc cần làm của một ruộng (backend ActionPlan). Câu chữ của từng việc do backend lập (cùng
 * câu với thông báo đẩy và khuyến nghị); ở đây chỉ có nhãn verdict, gom việc theo ngày và màu theo trạng thái ngày
 * (dùng lại utils/waterPlan.ts), để chế độ nông dân dùng lại.
 */

export const VERDICT: Record<PlanVerdict, { level: StatusLevel; label: string }> = {
  RED: { level: 'CRITICAL', label: 'Không lấy nước sông' },
  YELLOW: { level: 'WARNING', label: 'Sắp mặn' },
  GREEN: { level: 'SAFE', label: 'Lấy nước được' },
  GREY: { level: 'INFO', label: 'Chưa biết' },
};

/** "Hôm nay", "Ngày mai", còn lại dd/MM; today = ngày đầu của kế hoạch nước */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hôm nay';
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  if (date === next.toISOString().slice(0, 10)) return 'Ngày mai';
  return formatDay(date);
}

export interface ActionGroup {
  /** YYYY-MM-DD */
  date: string;
  label: string;
  /** Màu ô ngày, theo trạng thái nước ngày đó (như ô của kế hoạch nước) */
  chip: string;
  actions: PlanAction[];
}

/**
 * Gom việc theo ngày bắt đầu, theo thứ tự backend đã xếp. "Lấy nước được" (TAKE_WATER) tách riêng làm dòng cuối,
 * vì nó nói về cả tuần chứ không phải một ngày.
 */
export function groupByDay(plan: FieldPlan): { groups: ActionGroup[]; takeWater: PlanAction | null } {
  const days = plan.waterPlan?.days ?? [];
  const today = days[0]?.date ?? plan.actions[0]?.from ?? '';
  const statusOn = new Map<string, WaterDay['status']>(days.map((d) => [d.date, d.status]));
  const groups: ActionGroup[] = [];
  let takeWater: PlanAction | null = null;
  for (const a of plan.actions) {
    if (a.kind === 'TAKE_WATER') {
      takeWater = a;
      continue;
    }
    let group = groups.find((g) => g.date === a.from);
    if (!group) {
      group = {
        date: a.from,
        label: dayLabel(a.from, today),
        chip: WATER_DAY_CHIP[statusOn.get(a.from) ?? 'UNKNOWN'],
        actions: [],
      };
      groups.push(group);
    }
    group.actions.push(a);
  }
  groups.sort((x, y) => x.date.localeCompare(y.date));
  return { groups, takeWater };
}

/** Chấm mức ưu tiên, như RecommendationList */
export const PRIORITY_DOT: Record<PlanAction['priority'], string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-gray-400',
};

/**
 * Khuyến nghị theo ruộng: tách "Ruộng A (lúa)" khỏi phần việc để in đậm tên ruộng. null khi là khuyến nghị chung
 * hoặc message không bắt đầu bằng tên ruộng.
 */
export function splitFieldPrefix(rec: RecommendationDto): { field: string; text: string } | null {
  if (!rec.fieldName || !rec.message.startsWith(`${rec.fieldName} (`)) return null;
  const end = rec.message.indexOf('): ', rec.fieldName.length);
  if (end < 0) return null;
  return { field: rec.message.slice(0, end + 1), text: rec.message.slice(end + 3) };
}

/** Có khuyến nghị nào theo ruộng của người đang xem không */
export const isPersonal = (items: RecommendationDto[]) => items.some((r) => r.fieldId != null);
