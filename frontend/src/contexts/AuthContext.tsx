import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type AuthConfig, type LoginResponse, type RegisterRequest } from '../api/authApi';
import { clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../auth/tokenStorage';
import type { User } from '../types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

/** Backend không trả lời được /auth/config: vẫn cho xem trang (các API sẽ tự báo lỗi), chỉ ẩn đăng ký/Google */
const FALLBACK_CONFIG: AuthConfig = { publicRead: true, registrationEnabled: false, googleClientId: null, zaloAppId: null };

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** undefined khi đang tải */
  config: AuthConfig | undefined;
  login: (username: string, password: string) => Promise<void>;
  register: (req: RegisterRequest) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithZalo: (code: string, codeVerifier: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Tải lại thông tin user (vd. sau khi đặt mật khẩu lần đầu) */
  refreshUser: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'anonymous'));

  const configQuery = useQuery({ queryKey: ['auth', 'config'], queryFn: authApi.config, staleTime: Infinity, retry: 1 });
  const config = configQuery.isError ? FALLBACK_CONFIG : configQuery.data;

  // Có token sẵn (F5 trang) -> kiểm tra còn hợp lệ không
  useEffect(() => {
    if (!getToken()) return;
    authApi
      .me()
      .then((u) => {
        setUser(u);
        setStatus('authenticated');
      })
      .catch(() => {
        clearToken();
        setStatus('anonymous');
      });
  }, []);

  const resetSession = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // API trả 401 khi đang có token -> phiên hết hạn
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, resetSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, resetSession);
  }, [resetSession]);

  const startSession = useCallback(
    (res: LoginResponse) => {
      setToken(res.accessToken);
      setUser(res.user);
      setStatus('authenticated');
      // Dữ liệu tải lúc chưa đăng nhập có thể thiếu (vd. dự báo chưa được chạy lại)
      void queryClient.invalidateQueries();
    },
    [queryClient]
  );

  const login = useCallback(
    async (username: string, password: string) => startSession(await authApi.login(username, password)),
    [startSession]
  );
  const register = useCallback(async (req: RegisterRequest) => startSession(await authApi.register(req)), [startSession]);
  const loginWithGoogle = useCallback(async (idToken: string) => startSession(await authApi.google(idToken)), [startSession]);
  const loginWithZalo = useCallback(
    async (code: string, codeVerifier: string) => startSession(await authApi.zalo(code, codeVerifier)),
    [startSession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* token có thể đã hết hạn — vẫn đăng xuất phía client */
    }
    resetSession();
  }, [resetSession]);

  const refreshUser = useCallback(async () => setUser(await authApi.me()), []);

  const hasRole = useCallback((...roles: string[]) => !!user?.roles?.some((r) => roles.includes(r)), [user]);

  const value = useMemo(
    () => ({ user, status, config, login, register, loginWithGoogle, loginWithZalo, logout, refreshUser, hasRole }),
    [user, status, config, login, register, loginWithGoogle, loginWithZalo, logout, refreshUser, hasRole]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}
