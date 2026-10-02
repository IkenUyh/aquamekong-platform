import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { authApi } from '../api/authApi';
import { consumeZaloCallback } from '../auth/zaloOAuth';
import { useAuth } from '../contexts/AuthContext';
import { AuthLayout } from '../components/AuthLayout';

const CANCELLED = 'Bạn đã huỷ đăng nhập bằng Zalo.';
const INVALID = 'Phiên đăng nhập Zalo không hợp lệ hoặc đã hết hạn. Vui lòng bấm nút Zalo lại.';

/** Zalo chuyển về đây kèm ?code=&state= sau khi người dùng cấp quyền */
export function ZaloCallbackPage() {
  const { loginWithZalo } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [backTo, setBackTo] = useState('/login');
  // code chỉ đổi được một lần; StrictMode chạy effect 2 lần khi dev
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const result = consumeZaloCallback(search);
    const back = result.intent === 'link' ? '/account' : '/login';
    setBackTo(back);
    if (!result.ok) {
      setError(result.reason === 'cancelled' ? CANCELLED : INVALID);
      return;
    }
    const action =
      result.intent === 'link'
        ? authApi.linkZalo(result.code, result.codeVerifier)
        : loginWithZalo(result.code, result.codeVerifier);
    action
      .then(() => navigate(result.from, { replace: true }))
      .catch((err) => setError(apiErrorMessage(err, 'Không đăng nhập được bằng Zalo, vui lòng thử lại.')));
  }, [search, loginWithZalo, navigate]);

  return (
    <AuthLayout>
      {error ? (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">Chưa đăng nhập được bằng Zalo</h1>
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          <Link to={backTo} className="btn-secondary w-full">
            {backTo === '/account' ? 'Về trang Tài khoản' : 'Về trang đăng nhập'}
          </Link>
        </div>
      ) : (
        <p className="text-sm text-gray-500" role="status">Đang đăng nhập bằng Zalo...</p>
      )}
    </AuthLayout>
  );
}
