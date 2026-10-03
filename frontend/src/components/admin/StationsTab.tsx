import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage, riverApi, stationApi } from '../../api/client';
import { useStationsList } from '../../hooks/useStations';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, type Column } from '../shared/DataTable';
import type { Station, StationStatus } from '../../types';
import { inputClass, labelClass, linkButton, primaryButton, secondaryButton } from './formStyles';

type StationForm = {
  id?: number; code: string; name: string; riverId: string; province: string;
  latitude: string; longitude: string; status: StationStatus;
};
const EMPTY: StationForm = { code: '', name: '', riverId: '', province: '', latitude: '', longitude: '', status: 'ACTIVE' };

export function StationsTab() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ROLE_ADMIN');
  const { data: stations = [] } = useStationsList();
  const { data: rivers = [] } = useQuery({ queryKey: ['rivers'], queryFn: riverApi.getAll });
  const [form, setForm] = useState<StationForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['stations'] });

  const save = useMutation({
    mutationFn: (f: StationForm) => {
      const body: Partial<Station> = {
        code: f.code.trim(), name: f.name.trim(), riverId: Number(f.riverId), province: f.province.trim() || undefined,
        latitude: Number(f.latitude), longitude: Number(f.longitude), status: f.status,
      };
      return f.id ? stationApi.update(f.id, body) : stationApi.create(body);
    },
    onSuccess: () => { setForm(EMPTY); setError(null); refresh(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => stationApi.delete(id),
    onSuccess: refresh,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const edit = (s: Station) => setForm({
    id: s.id, code: s.code, name: s.name, riverId: s.riverId ? String(s.riverId) : '', province: s.province ?? '',
    latitude: String(s.latitude), longitude: String(s.longitude), status: s.status,
  });

  const confirmDelete = (s: Station) => {
    if (window.confirm(`Xoá vĩnh viễn trạm "${s.name}"?\n\nToàn bộ số đo, thiết bị, rule và cảnh báo của trạm sẽ bị xoá theo. Nếu chỉ tạm dừng, hãy sửa trạng thái thành "Ngừng hoạt động".`)) {
      remove.mutate(s.id);
    }
  };

  const columns: Column<Station>[] = [
    { key: 'code', header: 'Mã', render: (s) => <span className="font-mono font-bold text-primary-600">{s.code}</span> },
    { key: 'name', header: 'Tên trạm', render: (s) => <span className="font-semibold text-gray-800">{s.name}</span> },
    { key: 'river', header: 'Sông', render: (s) => s.riverName ?? '—' },
    { key: 'province', header: 'Tỉnh/Thành', render: (s) => s.province ?? '—' },
    { key: 'coords', header: 'Toạ độ', render: (s) => <span className="font-mono text-xs text-gray-500">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</span> },
    { key: 'status', header: 'Trạng thái', render: (s) => s.status === 'ACTIVE'
      ? <span className="text-xs font-medium px-2 py-1 rounded bg-green-50 text-green-700">Hoạt động</span>
      : <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-500">Ngừng hoạt động</span> },
    { key: 'actions', header: '', align: 'right', render: (s) => (
      <div className="flex gap-3 justify-end">
        <button className={`${linkButton} text-primary-600`} onClick={() => edit(s)}>Sửa</button>
        {isAdmin && <button className={`${linkButton} text-red-600`} disabled={remove.isPending} onClick={() => confirmDelete(s)}>Xoá</button>}
      </div>
    ) },
  ];

  const set = (patch: Partial<StationForm>) => setForm({ ...form, ...patch });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
        className="card p-5 space-y-4 self-start">
        <h3 className="font-semibold text-gray-900">{form.id ? 'Sửa trạm' : 'Thêm trạm quan trắc'}</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="st-code" className={labelClass}>Mã trạm</label>
            <input id="st-code" required disabled={!!form.id} value={form.code} onChange={(e) => set({ code: e.target.value })}
              placeholder="VD: BL-001" className={`${inputClass} disabled:bg-gray-100`} />
          </div>
          <div className="col-span-2">
            <label htmlFor="st-name" className={labelClass}>Tên trạm</label>
            <input id="st-name" required value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="st-river" className={labelClass}>Sông</label>
          <select id="st-river" required value={form.riverId} onChange={(e) => set({ riverId: e.target.value })} className={inputClass}>
            <option value="" disabled>Chọn sông</option>
            {rivers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="st-province" className={labelClass}>Tỉnh/Thành</label>
          <input id="st-province" value={form.province} onChange={(e) => set({ province: e.target.value })} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="st-lat" className={labelClass}>Vĩ độ</label>
            <input id="st-lat" type="number" step="any" min={-90} max={90} required value={form.latitude}
              onChange={(e) => set({ latitude: e.target.value })} placeholder="10.0452" className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-lng" className={labelClass}>Kinh độ</label>
            <input id="st-lng" type="number" step="any" min={-180} max={180} required value={form.longitude}
              onChange={(e) => set({ longitude: e.target.value })} placeholder="105.7469" className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="st-status" className={labelClass}>Trạng thái</label>
          <select id="st-status" value={form.status} onChange={(e) => set({ status: e.target.value as StationStatus })} className={inputClass}>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Ngừng hoạt động</option>
          </select>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={save.isPending} className={primaryButton}>{form.id ? 'Lưu thay đổi' : 'Thêm trạm'}</button>
          {form.id && <button type="button" onClick={() => { setForm(EMPTY); setError(null); }} className={secondaryButton}>Huỷ</button>}
        </div>
      </form>

      <div className="xl:col-span-2 min-h-[400px]">
        <DataTable data={stations} columns={columns} keyExtractor={(s) => s.id} />
      </div>
    </div>
  );
}
