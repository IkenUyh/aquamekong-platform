import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { KeyRound, UserCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/authApi';

const MIN_PASSWORD_LENGTH = 8;

export function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(typeof message === 'string' ? message : 'Không đổi được mật khẩu, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
            <UserCircle className="w-12 h-12 text-blue-500" />
            <div>
              <p className="font-bold text-gray-800">{user?.fullName || user?.username}</p>
              <p className="text-sm text-gray-500">{user?.username} · {user?.email}</p>
              <p className="text-xs text-gray-400 mt-1">{user?.roles?.join(', ')}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Đổi mật khẩu
            </h2>

            <div className="space-y-1">
              <label htmlFor="current-password" className="text-xs font-semibold text-gray-500">Mật khẩu hiện tại</label>
              <input id="current-password" type="password" autoComplete="current-password" required
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-password" className="text-xs font-semibold text-gray-500">Mật khẩu mới (tối thiểu {MIN_PASSWORD_LENGTH} ký tự)</label>
              <input id="new-password" type="password" autoComplete="new-password" required
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label htmlFor="confirm-password" className="text-xs font-semibold text-gray-500">Nhập lại mật khẩu mới</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
            </div>

            {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {success && <p role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Đã đổi mật khẩu.</p>}

            <button type="submit" disabled={submitting}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
              {submitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
