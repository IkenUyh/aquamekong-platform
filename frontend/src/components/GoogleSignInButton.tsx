import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleIdentity } from '../auth/googleIdentity';

interface Props {
  clientId: string;
  /** Nhận ID token (credential) của Google; lỗi do component cha hiển thị */
  onCredential: (idToken: string) => void;
  text?: 'continue_with' | 'signup_with' | 'signin_with';
}

/** Nút chính thức của Google (bắt buộc theo hướng dẫn thương hiệu của Google), mở popup chọn tài khoản. */
export function GoogleSignInButton({ clientId, onCredential, text = 'continue_with' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentity()
      .then((gsi) => {
        if (cancelled || !ref.current) return;
        gsi.initialize({ client_id: clientId, ux_mode: 'popup', callback: (res) => callbackRef.current(res.credential) });
        gsi.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'center',
          // GSI nhận px, tối đa 400
          width: Math.min(400, Math.round(ref.current.getBoundingClientRect().width) || 320),
          locale: 'vi',
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (failed) {
    return <p className="text-xs text-gray-500 text-center">Không tải được đăng nhập Google. Kiểm tra kết nối mạng rồi tải lại trang.</p>;
  }
  // Giữ chỗ 44px để form không nhảy khi nút Google hiện ra
  return <div ref={ref} className="w-full min-h-[44px] flex justify-center overflow-hidden" />;
}
