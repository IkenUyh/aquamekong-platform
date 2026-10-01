import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { AlertRulesTab } from '../components/admin/AlertRulesTab';
import { StationsTab } from '../components/admin/StationsTab';
import { UsersTab } from '../components/admin/UsersTab';

type TabId = 'rules' | 'stations' | 'users';

const TABS: { id: TabId; label: string; adminOnly?: boolean }[] = [
  { id: 'rules', label: 'Rule cảnh báo' },
  { id: 'stations', label: 'Trạm quan trắc' },
  { id: 'users', label: 'Người dùng', adminOnly: true },
];

/** Quản trị: OPERATOR quản lý rule & trạm; ADMIN thêm quản lý người dùng (backend kiểm tra lại quyền). */
export function AdminPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ROLE_ADMIN');
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const [active, setActive] = useState<TabId>('rules');

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Quản trị hệ thống</h1>
            <p className="text-sm text-gray-500">Cấu hình rule cảnh báo, danh mục trạm{isAdmin && ' và tài khoản người dùng'}</p>
          </div>

          <div role="tablist" className="flex gap-2 border-b border-gray-200 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setActive(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                  active === t.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {active === 'rules' && <AlertRulesTab />}
            {active === 'stations' && <StationsTab />}
            {active === 'users' && isAdmin && <UsersTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
