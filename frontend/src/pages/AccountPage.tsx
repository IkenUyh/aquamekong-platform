import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navbar } from '../components/Navbar';
import { BottomNav } from '../components/BottomNav';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { ZaloButton } from '../components/ZaloButton';
import { PushSettings } from '../components/PushSettings';
import { useAuth } from '../contexts/AuthContext';
import { authApi, type LinkedIdentity } from '../api/authApi';
import { apiErrorMessage } from '../api/client';
import { createPasskey, passkeyErrorMessage, passkeySupported } from '../auth/passkey';

const MIN_PASSWORD_LENGTH = 8;
const IDENTITIES_KEY = ['auth', 'identities'];

function PasswordForm() {
  const { user, refreshUser } = useAuth();
  // Tài khoản tạo bằng Zalo/Google: đặt mật khẩu lần đầu, không hỏi mật khẩu cũ
  const hasPassword = user?.hasPassword !== false;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
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
      await authApi.changePassword(hasPassword ? currentPassword : undefined, newPassword);
      setSuccess(hasPassword ? 'Đã đổi mật khẩu.' : `Đã đặt mật khẩu. Từ giờ bạn có thể đăng nhập bằng tên ${user?.username}.`);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (!hasPassword) await refreshUser();
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được mật khẩu, vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">{hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}</h2>
        {!hasPassword && (
          <p className="mt-1 text-sm text-gray-500">
            Tài khoản đang đăng nhập bằng Zalo hoặc Google. Đặt mật khẩu để đăng nhập được cả bằng tên <span className="font-medium">{user?.username}</span>.
          </p>
        )}
      </div>

      {hasPassword && (
        <div>
          <label htmlFor="current-password" className="field-label">Mật khẩu hiện tại</label>
          <input id="current-password" type="password" autoComplete="current-password" required
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="field" />
        </div>
      )}
      <div>
        <label htmlFor="new-password" className="field-label">Mật khẩu mới (tối thiểu {MIN_PASSWORD_LENGTH} ký tự)</label>
        <input id="new-password" type="password" autoComplete="new-password" required
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field" />
      </div>
      <div>
        <label htmlFor="confirm-password" className="field-label">Nhập lại mật khẩu mới</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="field" />
      </div>

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      {success && <p role="status" className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">{success}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
        {submitting ? 'Đang lưu...' : hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
      </button>
    </form>
  );
}

const PROVIDER_LABELS: Record<LinkedIdentity['provider'], string> = { zalo: 'Zalo', google: 'Google' };

function LinkedAccounts({ googleClientId, zaloAppId }: { googleClientId: string | null; zaloAppId: string | null }) {
  const queryClient = useQueryClient();
  const { data: identities = [], isLoading } = useQuery({ queryKey: IDENTITIES_KEY, queryFn: authApi.identities });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: IDENTITIES_KEY });
    } catch (err) {
      setError(apiErrorMessage(err, 'Không thực hiện được, vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const providers = (['zalo', 'google'] as const).filter((p) => (p === 'zalo' ? zaloAppId : googleClientId));

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Tài khoản liên kết</h2>
        <p className="mt-1 text-sm text-gray-500">Đăng nhập nhanh bằng Zalo hoặc Google thay cho mật khẩu.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Đang tải...</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {providers.map((provider) => {
            const linked = identities.find((i) => i.provider === provider);
            return (
              <li key={provider} className="py-3 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{PROVIDER_LABELS[provider]}</p>
                    <p className="text-sm text-gray-500 truncate">{linked ? linked.email ?? 'Đã liên kết' : 'Chưa liên kết'}</p>
                  </div>
                  {linked && (
                    <button type="button" disabled={busy} onClick={() => void act(() => authApi.unlink(provider))} className="btn-secondary shrink-0">
                      Huỷ liên kết
                    </button>
                  )}
                </div>
                {!linked && provider === 'zalo' && zaloAppId && (
                  <ZaloButton appId={zaloAppId} intent="link" from="/account" label="Liên kết Zalo" />
                )}
                {!linked && provider === 'google' && googleClientId && (
                  <GoogleSignInButton clientId={googleClientId} text="continue_with"
                    onCredential={(token) => void act(() => authApi.linkGoogle(token))} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
    </section>
  );
}

const PASSKEYS_KEY = ['auth', 'passkeys'];
const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');

function Passkeys() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const { data: passkeys = [], isLoading } = useQuery({ queryKey: PASSKEYS_KEY, queryFn: authApi.passkeys });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (action: () => Promise<unknown>, done?: string) => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY });
      if (done) setSuccess(done);
    } catch (err) {
      setError(passkeyErrorMessage(err) ?? apiErrorMessage(err, 'Không thực hiện được, vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    void act(async () => {
      const options = await authApi.passkeyRegisterStart();
      const credential = await createPasskey(options.publicKey);
      await authApi.passkeyRegisterFinish(options.requestId, credential, name.trim());
      setName('');
    }, 'Đã thêm passkey. Lần sau bấm "Đăng nhập bằng passkey" ở trang đăng nhập.');
  };

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Passkey</h2>
        <p className="mt-1 text-sm text-gray-500">
          Đăng nhập bằng vân tay, Face ID, mã PIN của thiết bị hoặc khoá bảo mật, không cần mật khẩu.
          {hasRole('ROLE_OPERATOR', 'ROLE_ADMIN') && ' Khuyên dùng cho tài khoản cán bộ: passkey không bị lộ qua trang web giả mạo.'}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Đang tải...</p>
      ) : passkeys.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {passkeys.map((p) => (
            <li key={p.id} className="py-3 first:pt-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-500">
                  Tạo {dateTime(p.createdAt)}{p.lastUsedAt ? ` · Dùng lần cuối ${dateTime(p.lastUsedAt)}` : ' · Chưa dùng'}
                </p>
              </div>
              <button type="button" disabled={busy} onClick={() => void act(() => authApi.deletePasskey(p.id))} className="btn-secondary shrink-0">
                Xoá
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="passkey-name" className="sr-only">Tên passkey</label>
        <input id="passkey-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
          placeholder="Tên gợi nhớ, vd. Điện thoại của tôi" className="field flex-1" />
        <button type="submit" disabled={busy} className="btn-primary shrink-0">
          {busy ? 'Đang chờ thiết bị...' : 'Thêm passkey'}
        </button>
      </form>

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      {success && <p role="status" className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">{success}</p>}
    </section>
  );
}

export function AccountPage() {
  const { user, config } = useAuth();

  return (
    <div className="flex flex-col h-dvh w-screen bg-[var(--color-bg)]">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="card p-5">
            <p className="font-semibold text-gray-900">{user?.fullName || user?.username}</p>
            <p className="text-sm text-gray-500">{[user?.username, user?.email].filter(Boolean).join(' · ')}</p>
            <p className="text-xs text-gray-400 mt-1">{user?.roles?.join(', ')}</p>
          </div>

          <PushSettings />
          <PasswordForm />
          {config?.passkeyEnabled && passkeySupported() && <Passkeys />}
          {(config?.googleClientId || config?.zaloAppId) && (
            <LinkedAccounts googleClientId={config.googleClientId} zaloAppId={config.zaloAppId} />
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
