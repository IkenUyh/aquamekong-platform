import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ZaloButton } from './ZaloButton';
import { OrDivider } from './AuthLayout';

interface Props {
  /** Nhận ID token của Google; lỗi do trang cha hiển thị */
  onGoogle: (idToken: string) => void;
  /** Trang quay lại sau khi đăng nhập Zalo (Zalo chuyển hướng cả trang) */
  from: string;
  variant: 'login' | 'register';
}

/** Các nút đăng nhập ngoài đang bật + đường kẻ "hoặc". Không hiện gì nếu chưa cấu hình nhà cung cấp nào. */
export function SocialLogin({ onGoogle, from, variant }: Props) {
  const { config } = useAuth();
  if (!config?.zaloAppId && !config?.googleClientId) return null;
  return (
    <>
      <div className="space-y-3">
        {config.zaloAppId && (
          <ZaloButton appId={config.zaloAppId} intent="login" from={from}
            label={variant === 'register' ? 'Đăng ký bằng Zalo' : 'Tiếp tục với Zalo'} />
        )}
        {config.googleClientId && (
          <GoogleSignInButton clientId={config.googleClientId} onCredential={onGoogle}
            text={variant === 'register' ? 'signup_with' : 'continue_with'} />
        )}
      </div>
      <OrDivider />
    </>
  );
}
