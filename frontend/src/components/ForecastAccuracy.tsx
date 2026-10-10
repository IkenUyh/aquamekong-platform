import React, { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  skillPercent, type EarlyWarningEvaluation, type ForecastAccuracy, type LeadAccuracy, type StationAccuracy,
} from '../api/accuracyApi';
import { CROP_PRESETS } from '../utils/crops';
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

/** Nhãn ngưỡng: ngưỡng chung 4‰ hoặc các loại cây dùng ngưỡng đó */
function thresholdLabel(threshold: number): string {
  if (threshold === SALINITY_THRESHOLD) return `${formatNumber(threshold)}‰ (ngưỡng chung)`;
  const crops = CROP_PRESETS.filter((c) => c.threshold === threshold).map((c) => c.crop.toLowerCase());
  return crops.length > 0 ? `${formatNumber(threshold)}‰ (${crops.join(', ')})` : `${formatNumber(threshold)}‰`;
}

/**
 * Cảnh báo sớm trên các mùa khô cũ: mỗi mùa, mô hình rủi ro chỉ học số đo trước mùa đó rồi chạy lại từng sáng
 * như app thật (ml-service app/early_warning/episodes.py mô phỏng đúng cách app báo người theo dõi trạm).
 */
export function EarlyWarningCard({ evaluation }: { evaluation: EarlyWarningEvaluation }) {
  const thresholds = evaluation.seasons[0]?.thresholds.map((t) => t.threshold) ?? [];
  const [threshold, setThreshold] = useState(thresholds.includes(SALINITY_THRESHOLD) ? SALINITY_THRESHOLD : thresholds[0]);
  const seasons = [...evaluation.seasons].reverse();
  return (
    <div className="card p-3 text-xs text-gray-600 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">Cảnh báo sớm trên các mùa khô đã qua</p>
        <label className="flex items-center gap-2">
          <span className="sr-only">Ngưỡng</span>
          <select className="field w-auto py-1 text-xs" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
            {thresholds.map((t) => <option key={t} value={t}>{thresholdLabel(t)}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full num">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="font-normal py-1 pr-2">Mùa khô</th>
              <th className="font-normal py-1 pr-2 text-right">Lần vượt ngưỡng</th>
              <th className="font-normal py-1 pr-2 text-right">Đã cảnh báo từ trước</th>
              <th className="font-normal py-1 text-right">Báo sớm đúng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {seasons.map((s) => {
              const t = s.thresholds.find((x) => x.threshold === threshold);
              if (!t) return null;
              return (
                <tr key={s.label}>
                  <td className="py-1 pr-2 whitespace-nowrap">{s.label.replace('Mùa khô ', '')}</td>
                  <td className="py-1 pr-2 text-right">{t.onsets}</td>
                  <td className="py-1 pr-2 text-right">
                    {t.covered}{t.onsets > 0 && <span className="text-gray-400"> ({pct(t.covered / t.onsets)})</span>}
                  </td>
                  <td className="py-1 text-right">{t.hits}/{t.warnings}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-gray-400">
        Mỗi mùa, mô hình chỉ học số đo trước mùa đó rồi chạy lại từng sáng như app thật. Đã cảnh báo từ trước: lần trạm bắt đầu
        vượt ngưỡng mà từ hôm trước app đã báo vượt hoặc có nguy cơ, chưa báo hết mặn; nếu chỉ giữ nguyên số đo mới nhất thì
        luôn là 0. Báo sớm đúng: trong các lần app báo nguy cơ khi số đo còn dưới ngưỡng, bao nhiêu lần sau đó mặn vượt thật.
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

  // Mọi dự báo đã lưu đã có số thật, mới nhất trước (không chỉ mốc seriesLead: những ngày đầu chỉ có dự báo trước 1-2 ngày)
  const stored = [...verification].sort((a, b) => b.forecastDate.localeCompare(a.forecastDate) || a.leadDays - b.leadDays);
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
          </p>
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-700">Dự báo đã lưu so với số đo thật</p>
            {stored.length === 0 ? (
              <p className="mt-1 text-[11px] text-gray-400">
                Chưa có: mỗi ngày app lưu dự báo, và so với số thật khi số đo của ngày được dự báo về (sáng hôm sau).
              </p>
            ) : (
              <>
                <table className="mt-1 w-full text-xs num">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="font-normal py-1">Ngày</th>
                      <th className="font-normal py-1">Dự báo trước</th>
                      <th className="font-normal py-1 text-right">Dự báo</th>
                      <th className="font-normal py-1 text-right">Thực tế</th>
                      <th className="font-normal py-1 text-right">Lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {stored.slice(0, 7).map((v) => (
                      <tr key={`${v.forecastDate}-${v.leadDays}`}>
                        <td className="py-1">{shortDate(v.forecastDate)}</td>
                        <td className="py-1">{v.leadDays} ngày</td>
                        <td className="py-1 text-right">{formatNumber(v.predicted)}‰</td>
                        <td className="py-1 text-right">{formatNumber(v.actual)}‰</td>
                        <td className="py-1 text-right">{formatNumber(Math.abs(v.predicted - v.actual))}‰</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[11px] text-gray-400">
                  {stored.length} dự báo đã có số thật trong 30 ngày qua, lệch trung bình {formatNumber(storedMae)}‰.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
