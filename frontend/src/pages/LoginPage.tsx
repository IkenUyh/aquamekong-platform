import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { SocialLogin } from '../components/SocialLogin';

export function LoginPage() {
  const { login, loginWithGoogle, status, config } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to={from} replace />;

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setSubmitting(true);
    try {
      await action();
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Không kết nối được máy chủ, vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(() => login(username.trim(), password));
  };

  return (
    <AuthLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Đăng nhập</h1>
          <p className="mt-1 text-sm text-gray-500">
            {config?.registrationEnabled
              ? 'Xem dữ liệu không cần đăng nhập. Đăng nhập để chạy dự báo và dùng các tính năng cá nhân.'
              : 'Dùng tài khoản được quản trị viên cấp.'}
          </p>
        </div>

        <SocialLogin variant="login" from={from} onGoogle={(token) => void run(() => loginWithGoogle(token))} />

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="field-label">Tên đăng nhập</label>
            <input id="username" autoComplete="username" required
              value={username} onChange={(e) => setUsername(e.target.value)} className="field" />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="field-label">Mật khẩu</label>
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
                aria-controls="password" aria-pressed={showPassword}>
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {config?.registrationEnabled && (
          <p className="text-center text-sm text-gray-500">
            Chưa có tài khoản?{' '}
            <Link to="/register" state={location.state} className="font-medium text-primary hover:underline">Đăng ký</Link>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
