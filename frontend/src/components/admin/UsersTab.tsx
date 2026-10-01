import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage, userApi, type CreateUserRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, type Column } from '../shared/DataTable';
import type { User, UserStatus } from '../../types';
import { inputClass, labelClass, primaryButton } from './formStyles';

const ROLES = [
  { name: 'ROLE_USER', label: 'Người dùng', hint: 'Xem dữ liệu, chạy dự báo' },
  { name: 'ROLE_OPERATOR', label: 'Vận hành', hint: '+ Quản lý trạm, rule, xử lý cảnh báo' },
  { name: 'ROLE_ADMIN', label: 'Quản trị', hint: '+ Quản lý người dùng' },
];
const STATUS_LABELS: Record<UserStatus, string> = { ACTIVE: 'Hoạt động', INACTIVE: 'Ngừng', SUSPENDED: 'Tạm khoá' };
const MIN_PASSWORD_LENGTH = 8;

const EMPTY: CreateUserRequest = { username: '', email: '', fullName: '', password: '', roles: ['ROLE_USER'] };

export function UsersTab() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: userApi.getAll });
  const [form, setForm] = useState<CreateUserRequest>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const create = useMutation({
    mutationFn: userApi.create,
    onSuccess: () => { setForm(EMPTY); setError(null); refresh(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: UserStatus }) => userApi.updateStatus(id, status),
    onSuccess: () => { setRowError(null); refresh(); },
    onError: (e) => { setRowError(apiErrorMessage(e)); refresh(); },
  });
  const toggleRole = useMutation({
    mutationFn: ({ u, role }: { u: User; role: string }) =>
      u.roles?.includes(role) ? userApi.removeRole(u.id, role) : userApi.addRole(u.id, role),
    onSuccess: () => { setRowError(null); refresh(); },
    onError: (e) => setRowError(apiErrorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);
      return;
    }
    if (form.roles.length === 0) {
      setError('Chọn ít nhất một vai trò');
      return;
    }
    create.mutate({ ...form, fullName: form.fullName?.trim() || undefined });
  };

  const columns: Column<User>[] = [
    { key: 'user', header: 'Tài khoản', render: (u) => (
      <div>
        <p className="font-semibold text-gray-800">{u.fullName || u.username}{u.username === me?.username && <span className="text-xs text-gray-400 font-normal"> (bạn)</span>}</p>
        <p className="text-xs text-gray-400">{u.username} · {u.email}</p>
      </div>
    ) },
    { key: 'roles', header: 'Vai trò', render: (u) => (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {ROLES.map((r) => (
          <label key={r.name} className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer" title={r.hint}>
            <input type="checkbox" checked={!!u.roles?.includes(r.name)} disabled={toggleRole.isPending}
              onChange={() => toggleRole.mutate({ u, role: r.name })} className="rounded border-gray-300" />
            {r.label}
          </label>
        ))}
      </div>
    ) },
    { key: 'status', header: 'Trạng thái', render: (u) => (
      <select aria-label={`Trạng thái ${u.username}`} value={u.status} disabled={setStatus.isPending}
        onChange={(e) => setStatus.mutate({ id: u.id, status: e.target.value as UserStatus })}
        className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white">
        {(Object.keys(STATUS_LABELS) as UserStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
    ) },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4 self-start">
        <h3 className="font-bold text-gray-800">Thêm người dùng</h3>
        <div>
          <label htmlFor="u-username" className={labelClass}>Tên đăng nhập</label>
          <input id="u-username" required autoComplete="off" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} className={inputClass} />
        </div>
        <div>
          <label htmlFor="u-fullname" className={labelClass}>Họ tên</label>
          <input id="u-fullname" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label htmlFor="u-email" className={labelClass}>Email</label>
          <input id="u-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label htmlFor="u-password" className={labelClass}>Mật khẩu ban đầu (tối thiểu {MIN_PASSWORD_LENGTH} ký tự)</label>
          <input id="u-password" type="password" required autoComplete="new-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
        </div>
        <fieldset className="space-y-1">
          <legend className={labelClass}>Vai trò</legend>
          {ROLES.map((r) => (
            <label key={r.name} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="mt-1 rounded border-gray-300" checked={form.roles.includes(r.name)}
                onChange={() => setForm({ ...form, roles: form.roles.includes(r.name) ? form.roles.filter((x) => x !== r.name) : [...form.roles, r.name] })} />
              <span>{r.label} <span className="text-xs text-gray-400">— {r.hint}</span></span>
            </label>
          ))}
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={create.isPending} className={primaryButton}>Thêm người dùng</button>
      </form>

      <div className="xl:col-span-2 min-h-[400px] flex flex-col gap-2">
        {rowError && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{rowError}</p>}
        <div className="flex-1">
          <DataTable data={users} columns={columns} keyExtractor={(u) => u.id} />
        </div>
      </div>
    </div>
  );
}
