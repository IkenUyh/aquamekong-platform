import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { SocialLogin } from '../components/SocialLogin';

const MIN_PASSWORD_LENGTH = 8;
// Giống @Pattern của RegisterRequest ở backend
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;

export function RegisterPage() {
  const { register, loginWithGoogle, status, config } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to={from} replace />;
  if (config && !config.registrationEnabled) {
    return (
      <AuthLayout>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-gray-900">Chưa mở đăng ký</h1>
          <p className="text-sm text-gray-500">Vui lòng liên hệ quản trị viên để được cấp tài khoản.</p>
          <Link to="/login" className="inline-block text-sm font-medium text-primary hover:underline">Về trang đăng nhập</Link>
        </div>
      </AuthLayout>
    );
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

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
    if (!USERNAME_PATTERN.test(form.username.trim())) {
      setError('Tên đăng nhập 3–50 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang.');
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (form.password !== form.confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    void run(() =>
      register({
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim() || undefined,
        password: form.password,
      })
    );
  };

  return (
    <AuthLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tạo tài khoản</h1>
          <p className="mt-1 text-sm text-gray-500">Miễn phí. Tài khoản mới có quyền xem dữ liệu và chạy dự báo.</p>
        </div>

        <SocialLogin variant="register" from={from} onGoogle={(token) => void run(() => loginWithGoogle(token))} />

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="fullName" className="field-label">Họ tên</label>
            <input id="fullName" autoComplete="name" value={form.fullName} onChange={set('fullName')} className="field" />
          </div>
          <div>
            <label htmlFor="reg-username" className="field-label">Tên đăng nhập</label>
            <input id="reg-username" autoComplete="username" required value={form.username} onChange={set('username')} className="field"
              aria-describedby="reg-username-hint" />
            <p id="reg-username-hint" className="mt-1 text-xs text-gray-400">Chữ không dấu, số, dấu chấm hoặc gạch dưới, 3–50 ký tự.</p>
          </div>
          <div>
            <label htmlFor="reg-email" className="field-label">Email</label>
            <input id="reg-email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} className="field" />
          </div>
          <div>
            <label htmlFor="reg-password" className="field-label">Mật khẩu (tối thiểu {MIN_PASSWORD_LENGTH} ký tự)</label>
            <input id="reg-password" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} className="field" />
          </div>
          <div>
            <label htmlFor="reg-confirm" className="field-label">Nhập lại mật khẩu</label>
            <input id="reg-confirm" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} className="field" />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
            {submitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Đã có tài khoản?{' '}
          <Link to="/login" state={location.state} className="font-medium text-primary hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
