import React, { useState } from 'react';
import { Bell, Radio, Users } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { AlertRulesTab } from '../components/admin/AlertRulesTab';
import { StationsTab } from '../components/admin/StationsTab';
import { UsersTab } from '../components/admin/UsersTab';

type TabId = 'rules' | 'stations' | 'users';

const TABS: { id: TabId; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { id: 'rules', label: 'Rule cảnh báo', icon: <Bell className="w-4 h-4" /> },
  { id: 'stations', label: 'Trạm quan trắc', icon: <Radio className="w-4 h-4" /> },
  { id: 'users', label: 'Người dùng', icon: <Users className="w-4 h-4" />, adminOnly: true },
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
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quản trị hệ thống</h1>
            <p className="text-sm text-gray-500">Cấu hình rule cảnh báo, danh mục trạm{isAdmin && ' và tài khoản người dùng'}</p>
          </div>

          <div role="tablist" className="flex gap-2 border-b border-gray-200">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setActive(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
                  active === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.icon}{t.label}
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
