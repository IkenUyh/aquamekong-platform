import React, { useState } from 'react';
import { startZaloLogin, zaloSupported, type ZaloIntent } from '../auth/zaloOAuth';

interface Props {
  appId: string;
  intent: ZaloIntent;
  /** Trang quay lại sau khi Zalo trả về */
  from: string;
  label?: string;
}

/** Chuyển sang trang cấp quyền của Zalo. Cùng kích thước với nút Google để hai nút xếp đều nhau. */
export function ZaloButton({ appId, intent, from, label = 'Tiếp tục với Zalo' }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  if (!zaloSupported()) {
    return <p className="text-xs text-gray-500 text-center">Đăng nhập Zalo cần trang chạy bằng HTTPS.</p>;
  }

  const onClick = async () => {
    setError(null);
    setRedirecting(true);
    try {
      await startZaloLogin(appId, intent, from);
    } catch (err) {
      setRedirecting(false);
      setError(err instanceof Error ? err.message : 'Không mở được Zalo, vui lòng thử lại.');
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={onClick} disabled={redirecting} className="btn-secondary w-full h-10">
        {redirecting ? 'Đang chuyển sang Zalo...' : label}
      </button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
