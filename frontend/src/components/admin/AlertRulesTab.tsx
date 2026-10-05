import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertApi } from '../../api/alertApi';
import { apiErrorMessage } from '../../api/client';
import { useStationsList } from '../../hooks/useStations';
import { DataTable, type Column } from '../shared/DataTable';
import type { AlertRule, AlertSeverity } from '../../types';
import { formatNumber, METRIC_LABELS, metricLabel } from '../../utils/salinity';
import { inputClass, labelClass, linkButton, primaryButton, secondaryButton } from './formStyles';

const OPERATORS = ['>', '>=', '<', '<=', '=='];
const SEVERITIES: { value: AlertSeverity; label: string }[] = [
  { value: 'CRITICAL', label: 'Nghiêm trọng' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'LOW', label: 'Thấp' },
];
const severityLabel = (s: AlertSeverity) => SEVERITIES.find((x) => x.value === s)?.label ?? s;

type RuleForm = { id?: number; stationId: string; metricType: string; operator: string; threshold: string; severity: AlertSeverity; isActive: boolean };
const EMPTY: RuleForm = { stationId: '', metricType: 'salinity', operator: '>', threshold: '4', severity: 'HIGH', isActive: true };

export function AlertRulesTab() {
  const queryClient = useQueryClient();
  const { data: rules = [] } = useQuery({ queryKey: ['alerts', 'rules'], queryFn: alertApi.getRules });
  const { data: stations = [] } = useStationsList();
  const [form, setForm] = useState<RuleForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });

  const save = useMutation({
    mutationFn: (rule: Partial<AlertRule>) => alertApi.saveRule(rule),
    onSuccess: () => { setForm(EMPTY); setError(null); refresh(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => alertApi.deleteRule(id),
    onSuccess: refresh,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      id: form.id,
      stationId: Number(form.stationId),
      metricType: form.metricType,
      operator: form.operator,
      threshold: Number(form.threshold),
      severity: form.severity,
      isActive: form.isActive,
    });
  };

  const edit = (r: AlertRule) =>
    setForm({ id: r.id, stationId: String(r.stationId), metricType: r.metricType, operator: r.operator, threshold: String(r.threshold), severity: r.severity, isActive: r.isActive });

  const toggleActive = (r: AlertRule) => save.mutate({ ...r, isActive: !r.isActive });

  const confirmDelete = (r: AlertRule) => {
    if (window.confirm(`Xoá rule "${r.stationName}: ${metricLabel(r.metricType).label} ${r.operator} ${r.threshold}"?\n\nToàn bộ lịch sử cảnh báo của rule này cũng bị xoá. Muốn giữ lịch sử, hãy chọn "Tắt" thay vì xoá.`)) {
      remove.mutate(r.id);
    }
  };

  const columns: Column<AlertRule>[] = [
    { key: 'station', header: 'Trạm', render: (r) => <span className="font-semibold text-gray-800">{r.stationName}</span> },
    { key: 'condition', header: 'Điều kiện', render: (r) => {
      const m = metricLabel(r.metricType);
      return `${m.label} ${r.operator} ${formatNumber(r.threshold)}${m.unit}`;
    } },
    { key: 'severity', header: 'Mức độ', render: (r) => severityLabel(r.severity) },
    { key: 'active', header: 'Trạng thái', render: (r) => r.isActive
      ? <span className="text-xs font-medium px-2 py-1 rounded bg-green-50 text-green-700">Đang bật</span>
      : <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-500">Đã tắt</span> },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <div className="flex gap-3 justify-end">
        <button className={`${linkButton} text-primary-600`} onClick={() => edit(r)}>Sửa</button>
        <button className={`${linkButton} text-amber-600`} disabled={save.isPending} onClick={() => toggleActive(r)}>{r.isActive ? 'Tắt' : 'Bật'}</button>
        <button className={`${linkButton} text-red-600`} disabled={remove.isPending} onClick={() => confirmDelete(r)}>Xoá</button>
      </div>
    ) },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      <form onSubmit={submit} className="card p-5 space-y-4 self-start">
        <h3 className="font-semibold text-gray-900">{form.id ? 'Sửa rule cảnh báo' : 'Thêm rule cảnh báo'}</h3>
        <div>
          <label htmlFor="rule-station" className={labelClass}>Trạm</label>
          <select id="rule-station" required value={form.stationId} onChange={(e) => setForm({ ...form, stationId: e.target.value })} className={inputClass}>
            <option value="" disabled>Chọn trạm</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rule-metric" className={labelClass}>Chỉ số</label>
          <select id="rule-metric" value={form.metricType} onChange={(e) => setForm({ ...form, metricType: e.target.value })} className={inputClass}>
            {Object.entries(METRIC_LABELS).map(([k, m]) => <option key={k} value={k}>{m.label} ({m.unit})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="rule-op" className={labelClass}>Điều kiện</label>
            <select id="rule-op" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} className={inputClass}>
              {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="rule-threshold" className={labelClass}>Ngưỡng ({metricLabel(form.metricType).unit})</label>
            <input id="rule-threshold" type="number" step="any" required value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="rule-severity" className={labelClass}>Mức độ cảnh báo</label>
          <select id="rule-severity" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as AlertSeverity })} className={inputClass}>
            {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300" />
          Bật rule ngay
        </label>
        {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={save.isPending} className={primaryButton}>{form.id ? 'Lưu thay đổi' : 'Thêm rule'}</button>
          {form.id && <button type="button" onClick={() => { setForm(EMPTY); setError(null); }} className={secondaryButton}>Huỷ</button>}
        </div>
      </form>

      <div className="xl:col-span-2 min-h-[400px]">
        <DataTable data={rules} columns={columns} keyExtractor={(r) => r.id} emptyText="Chưa có rule cảnh báo nào — hệ thống sẽ không sinh cảnh báo" />
      </div>
    </div>
  );
}
