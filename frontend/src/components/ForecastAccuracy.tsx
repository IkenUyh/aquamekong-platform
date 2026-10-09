import React, { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { skillPercent, type ForecastAccuracy, type LeadAccuracy, type StationAccuracy } from '../api/accuracyApi';
import { useForecastVerification } from '../hooks/useForecastAccuracy';
import { formatNumber, SALINITY_THRESHOLD } from '../utils/salinity';

const SHOWN_LEADS = [1, 3, 7];
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const pct = (v: number) => `${Math.round(v * 100)}%`;

function comparison(a: LeadAccuracy): string {
  const skill = skillPercent(a);
  if (skill === 0) return 'bằng giữ nguyên số mới nhất';
  return skill > 0 ? `tốt hơn giữ nguyên số mới nhất ${skill}%` : `kém hơn giữ nguyên số mới nhất ${-skill}%`;
}

/**
 * Dự báo đúng tới đâu, toàn vùng: chạy lại mô hình đang dùng trên các ngày đã qua (chỉ cho xem số đo tới hôm đó)
 * rồi so với số đo thật. So với "giữ nguyên số mới nhất", vì mô hình không hơn được cách đó thì không đáng tin.
 */
export function ForecastAccuracyCard({ accuracy }: { accuracy: ForecastAccuracy }) {
  const leads = accuracy.byLead.filter((l) => SHOWN_LEADS.includes(l.lead));
  if (leads.length === 0) return null;
  const sameAsBaseline = leads.every((l) => skillPercent(l) === 0);
  return (
    <div className="card p-3 text-xs text-gray-600 space-y-1">
      <p className="text-sm font-semibold text-gray-900">Độ chính xác dự báo</p>
      {leads.map((l) => (
        <p key={l.lead} className="num">
          Dự báo trước {l.lead} ngày: sai trung bình {formatNumber(l.mae)}‰, đoán đúng mức mặn {pct(l.levelAccuracy)}
          {!sameAsBaseline && <>, {comparison(l)}</>}
        </p>
      ))}
      <p className="text-gray-400">
        Chạy lại mô hình cho từng ngày từ {shortDate(accuracy.from)} đến {shortDate(accuracy.to)}, mỗi lần chỉ dùng số đo có tới hôm đó,
        rồi so với số đo thật của mọi trạm.
        {sameAsBaseline && ' Mô hình hiện tại giữ nguyên số đo mới nhất: cách này sai ít hơn kéo dài xu hướng gần đây.'}
      </p>
    </div>
  );
}

/** Dòng độ tin cậy trên thẻ trạm, kèm nút mở biểu đồ dự báo đặt cạnh số đo thật */
export function StationAccuracy({ stationId, accuracy, seriesLead }: {
  stationId: number;
  accuracy: StationAccuracy | undefined;
  seriesLead: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: verification = [] } = useForecastVerification(stationId, open);
  const lead = accuracy?.byLead.find((l) => l.lead === seriesLead);
  if (!accuracy || !lead) return null;

  const stored = verification.filter((v) => v.leadDays === seriesLead);
  const storedMae = stored.length > 0 ? stored.reduce((s, v) => s + Math.abs(v.predicted - v.actual), 0) / stored.length : null;
  const data = accuracy.series.map((p) => ({ ...p, label: shortDate(p.date) }));

  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-gray-500 num">
          Dự báo trước {seriesLead} ngày ở trạm này thường sai ±{formatNumber(lead.mae)}‰, đúng mức mặn {pct(lead.levelAccuracy)}
        </p>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="text-xs font-medium text-primary hover:underline shrink-0">
          {open ? 'Ẩn' : 'So với thực tế'}
        </button>
      </div>
      {open && (
        <div className="mt-2">
          <div className="h-[160px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number, name: string) => [`${formatNumber(v)}‰`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={SALINITY_THRESHOLD} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="actual" name="Số đo thật" stroke="#0F3D5E" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="predicted" name={`Dự báo trước ${seriesLead} ngày`} stroke="#94a3b8"
                  strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Đường nét đứt là dự báo mô hình đưa ra {seriesLead} ngày trước mỗi ngày, khi chạy lại trên số đo đã qua.
            {storedMae != null
              ? ` Dự báo đã lưu trong 30 ngày qua: ${stored.length} ngày đã có số thật, sai trung bình ${formatNumber(storedMae)}‰.`
              : ' Dự báo lưu hằng ngày sẽ được so với số thật khi số đo của ngày đó về.'}
          </p>
        </div>
      )}
    </div>
  );
}
