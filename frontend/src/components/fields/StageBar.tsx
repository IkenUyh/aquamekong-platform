import type { StageSegment } from '../../utils/cropSchedule';

/**
 * Thanh tiến độ vụ: mỗi giai đoạn một đoạn dài theo số ngày, giai đoạn hiện tại tô đậm, vạch ở ngày hôm nay.
 * Màu theo tông navy của app (xanh lá/vàng/đỏ dành cho độ mặn).
 */
export function StageBar({ segments, day, currentCode }: { segments: StageSegment[]; day: number | null; currentCode: string | null }) {
  const total = segments[segments.length - 1]?.end ?? 0;
  if (total <= 0) return null;
  // day là ngày thứ mấy (ngày gieo = 1): vạch ở giữa ngày đó, giới hạn trong thanh
  const marker = day == null ? null : Math.min(100, Math.max(0, ((day - 0.5) / total) * 100));

  return (
    <div className="space-y-1">
      <div className="relative">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {segments.map((s) => {
            const done = day != null && day > s.end;
            const current = s.code === currentCode;
            return (
              <div key={s.code} style={{ width: `${((s.end - s.start) / total) * 100}%` }}
                className={current ? 'bg-primary' : done ? 'bg-primary-300' : 'bg-gray-200'} />
            );
          })}
        </div>
        {marker != null && (
          <div className="absolute -top-1 h-[18px] w-0.5 -translate-x-1/2 rounded bg-gray-900" style={{ left: `${marker}%` }} aria-hidden="true" />
        )}
      </div>
      <div className="flex gap-0.5 text-[11px] leading-tight">
        {segments.map((s) => (
          <span key={s.code} style={{ width: `${((s.end - s.start) / total) * 100}%` }}
            className={`min-w-0 truncate ${s.code === currentCode ? 'font-semibold text-primary' : 'text-gray-500'}`}>
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
