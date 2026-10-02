import apiClient from './client';
import type { User } from '../types';

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

/** Các cách đăng nhập backend đang bật (GET /auth/config, công khai) */
export interface AuthConfig {
  /** Người chưa đăng nhập được xem dữ liệu */
  publicRead: boolean;
  registrationEnabled: boolean;
  /** null = chưa cấu hình đăng nhập Google */
  googleClientId: string | null;
  /** null = chưa cấu hình đăng nhập Zalo */
  zaloAppId: string | null;
  /** Backend đã cấu hình WEBAUTHN_RP_ID */
  passkeyEnabled: boolean;
}

/** Tham số cho navigator.credentials.create/get + requestId gửi kèm ở bước finish */
export interface PasskeyOptions {
  requestId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON WebAuthn do backend sinh
  publicKey: any;
}

export interface Passkey {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  fullName?: string;
  password: string;
}

export interface LinkedIdentity {
  provider: 'google' | 'zalo';
  email?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export const authApi = {
  config: () => apiClient.get<AuthConfig>('/auth/config').then((r) => r.data),
  login: (username: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  register: (req: RegisterRequest) => apiClient.post<LoginResponse>('/auth/register', req).then((r) => r.data),
  /** idToken: `credential` do Google Identity Services trả về */
  google: (idToken: string) => apiClient.post<LoginResponse>('/auth/google', { idToken }).then((r) => r.data),
  /** code Zalo trả về trang callback + code_verifier PKCE đã sinh trước khi chuyển sang Zalo */
  zalo: (code: string, codeVerifier: string) =>
    apiClient.post<LoginResponse>('/auth/zalo', { code, codeVerifier }).then((r) => r.data),
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
  logout: () => apiClient.post('/auth/logout'),
  /** currentPassword bỏ trống khi tài khoản chưa có mật khẩu (tạo bằng Google) */
  changePassword: (currentPassword: string | undefined, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
  identities: () => apiClient.get<LinkedIdentity[]>('/auth/identities').then((r) => r.data),
  linkGoogle: (idToken: string) => apiClient.post('/auth/identities/google', { idToken }),
  linkZalo: (code: string, codeVerifier: string) => apiClient.post('/auth/identities/zalo', { code, codeVerifier }),
  unlink: (provider: string) => apiClient.delete(`/auth/identities/${provider}`),
  passkeyLoginStart: () => apiClient.post<PasskeyOptions>('/auth/passkeys/login/start').then((r) => r.data),
  passkeyLoginFinish: (requestId: string, credential: object) =>
    apiClient.post<LoginResponse>('/auth/passkeys/login/finish', { requestId, credential }).then((r) => r.data),
  passkeys: () => apiClient.get<Passkey[]>('/auth/passkeys').then((r) => r.data),
  passkeyRegisterStart: () => apiClient.post<PasskeyOptions>('/auth/passkeys/register/start').then((r) => r.data),
  passkeyRegisterFinish: (requestId: string, credential: object, name: string) =>
    apiClient.post<Passkey>('/auth/passkeys/register/finish', { requestId, credential, name }).then((r) => r.data),
  deletePasskey: (id: number) => apiClient.delete(`/auth/passkeys/${id}`),
};
