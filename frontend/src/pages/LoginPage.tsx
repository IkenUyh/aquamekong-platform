import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

/** Hoạ tiết sóng mờ cho nửa trái (SVG thuần, không ảnh ngoài) */
function WavePattern() {
  return (
    <svg className="absolute inset-x-0 bottom-0 w-full h-64 opacity-[0.12]" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M0 ${60 + i * 34} C 100 ${30 + i * 34}, 200 ${90 + i * 34}, 300 ${60 + i * 34} S 500 ${30 + i * 34}, 600 ${60 + i * 34}`}
          stroke="#FFFFFF" strokeWidth="1.5" fill="none"
        />
      ))}
    </svg>
  );
}

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to={from} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Không kết nối được máy chủ, vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[var(--color-bg)]">
      {/* Nhận diện (≥ md) */}
      <aside className="relative hidden md:flex flex-col justify-between overflow-hidden bg-primary p-10 lg:p-14 text-white">
        <Logo tone="light" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Giám sát và dự báo xâm nhập mặn Đồng bằng sông Cửu Long</h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            Số đo độ mặn, mực nước và lưu lượng từ các trạm quan trắc; dự báo 7–14 ngày và cảnh báo khi vượt ngưỡng.
          </p>
        </div>
        <p className="relative text-xs text-white/50">AquaMekong · Hệ thống quan trắc thủy văn</p>
        <WavePattern />
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="md:hidden mb-8">
            <Logo tone="dark" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Đăng nhập</h1>
            <p className="mt-1 text-sm text-gray-500">Dùng tài khoản được quản trị viên cấp.</p>
          </div>

          <div>
            <label htmlFor="username" className="field-label">Tên đăng nhập</label>
            <input id="username" autoComplete="username" autoFocus required
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
      </main>
    </div>
  );
}
