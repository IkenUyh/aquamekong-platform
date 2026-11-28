import React from 'react';
import { CircleCheck, CircleHelp, OctagonX, Square, TriangleAlert, Volume2, type LucideIcon } from 'lucide-react';
import type { Crop } from '../../api/cropApi';
import { apiErrorMessage } from '../../api/client';
import type { FieldPlan } from '../../api/fieldApi';
import { useSpeech } from '../../hooks/useSpeech';
import { isNativeApp } from '../../platform';
import type { Station } from '../../types';
import { dayLabel, groupByDay } from '../../utils/actionPlan';
import { BIG_BUTTON, FARMER_DAY_CHIP, farmerDayLabel, farmerVerdict } from '../../utils/farmerMode';
import { formatMeasuredAt, formatNumber, isReporting } from '../../utils/salinity';
import { planSpeech } from '../../utils/speech';
import { Disclaimer } from '../Disclaimer';

const VERDICT_ICON: Record<ReturnType<typeof farmerVerdict>['icon'], LucideIcon> = {
  ok: CircleCheck,
  warn: TriangleAlert,
  stop: OctagonX,
  unknown: CircleHelp,
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};

/** Nút "Đọc to": chỉ hiện khi máy có giọng tiếng Việt; không có thì một dòng nhắc ngắn */
function ReadAloud({ plan }: { plan: FieldPlan }) {
  const { status, speaking, toggle } = useSpeech();
  if (status === 'loading') return null;
  if (status === 'unsupported') {
    return (
      <p className="text-lg text-gray-600">
        {isNativeApp ? 'Bản app chưa đọc to được. Mở trang web trên Chrome để nghe đọc.'
          : 'Máy này chưa có giọng đọc tiếng Việt nên chưa đọc to được.'}
      </p>
    );
  }
  const Icon = speaking ? Square : Volume2;
  return (
    <button type="button" onClick={() => toggle(planSpeech(plan))} aria-pressed={speaking}
      className={`${BIG_BUTTON} inline-flex items-center justify-center gap-2 bg-primary text-white`}>
      <Icon className="h-6 w-6" aria-hidden="true" />
      {speaking ? 'Dừng đọc' : 'Đọc to'}
    </button>
  );
}

/**
 * Màn hình trả lời của chế độ Nông dân: thẻ lớn "Lấy nước được / Cẩn thận / Không lấy nước sông / Chưa có số mới"
 * (chữ + biểu tượng, không chỉ màu), câu trả lời của backend, việc cần làm theo ngày, 8 ô ngày, đọc to.
 */
export function FarmerAnswer({ plan, isLoading, error, crop, station, title, updatedAt, onChange, onRetry }: {
  plan: FieldPlan | null | undefined;
  isLoading: boolean;
  error: unknown;
  crop: Crop | undefined;
  station: Station | undefined;
  /** "Lúa · trạm Mỹ Tho" hoặc tên ruộng */
  title: string;
  updatedAt: number;
  onChange: () => void;
  onRetry: () => void;
}) {
  const changeButton = (
    <button type="button" onClick={onChange} className={`${BIG_BUTTON} border-2 border-gray-300 bg-white text-gray-900`}>
      Đổi trạm/cây
    </button>
  );

  const header = (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Tuần này lấy nước được không?</h1>
      <p className="mt-1 text-lg text-gray-700">{title}</p>
    </div>
  );

  if (isLoading) {
    return (
      <section className="space-y-4">
        {header}
        <p className="text-lg text-gray-700" role="status">Đang xem tình hình nước...</p>
      </section>
    );
  }

  if (error || !plan) {
    return (
      <section className="space-y-4">
        {header}
        <div className="rounded-xl border-2 border-gray-300 bg-white p-4 text-lg text-gray-800">
          {error
            ? <p>Chưa lấy được kế hoạch: {apiErrorMessage(error, 'mất kết nối tới máy chủ.')}</p>
            : <p>Chưa lập được kế hoạch cho {crop ? crop.name.toLowerCase() : 'cây này'} hôm nay: giai đoạn hiện tại chưa có ngưỡng mặn.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {error != null && (
            <button type="button" onClick={onRetry} className={`${BIG_BUTTON} bg-primary text-white`}>Thử lại</button>
          )}
          {changeButton}
        </div>
      </section>
    );
  }

  const verdict = farmerVerdict(plan.verdict);
  const Icon = VERDICT_ICON[verdict.icon];
  const { groups, takeWater } = groupByDay(plan);
  const days = plan.waterPlan?.days ?? [];
  const today = days[0]?.date ?? '';
  const aquaculture = crop?.category === 'AQUACULTURE';

  return (
    <section className="space-y-6">
      {header}

      <div role="status" className={`flex items-center gap-4 rounded-2xl border-2 p-5 ${verdict.card}`}>
        <Icon className="h-14 w-14 shrink-0" strokeWidth={2.25} aria-hidden="true" />
        <p className="text-3xl font-bold leading-tight">{verdict.label}</p>
      </div>
      <p className="text-xl font-medium leading-relaxed text-gray-900 num">{plan.headline}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReadAloud plan={plan} />
        {changeButton}
      </div>

      {(groups.length > 0 || takeWater) && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-900">Việc cần làm</h2>
          <ol className="space-y-3">
            {groups.map((g) => (
              <li key={g.date} className="rounded-xl border-2 border-gray-200 bg-white p-3">
                <p className="text-lg font-bold text-gray-900 num">{g.label}</p>
                <ul className="mt-1 space-y-1.5">
                  {g.actions.map((a) => (
                    <li key={`${a.kind}-${a.from}-${a.source}`} className="text-lg leading-relaxed text-gray-900 num">
                      {a.priority === 'HIGH' && <span className="font-bold text-red-800">Quan trọng: </span>}
                      {a.message}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {takeWater && <p className="text-lg leading-relaxed text-gray-800 num">{takeWater.message}.</p>}
        </div>
      )}

      {days.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-900">Từng ngày</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {days.map((d) => (
              <li key={d.date} className={`rounded-xl border-2 px-3 py-2 ${FARMER_DAY_CHIP[d.status]}`}>
                <p className="text-lg num">{dayLabel(d.date, today)}</p>
                <p className="text-lg font-bold leading-snug">{farmerDayLabel(d.status, aquaculture)}</p>
                {d.salinity != null && <p className="text-lg num">{formatNumber(d.salinity)}‰</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-lg text-gray-700 num">
        {station?.lastMeasuredAt
          ? `Trạm ${station.name}: ${isReporting(station.lastMeasuredAt) ? 'số đo mới nhất' : 'mất tín hiệu, số đo cuối'} ${formatMeasuredAt(station.lastMeasuredAt)}.`
          : station ? `Trạm ${station.name}: chưa có số đo.` : null}
        {updatedAt > 0 && ` Cập nhật lúc ${clock(updatedAt)}.`}
      </p>
      <Disclaimer large />
    </section>
  );
}
