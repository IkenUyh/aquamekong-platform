import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../auth/tokenStorage';
import type { User } from '../types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'anonymous'));

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

  // API trả 401 ở bất kỳ đâu -> phiên hết hạn
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, resetSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, resetSession);
  }, [resetSession]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    setToken(res.accessToken);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* token có thể đã hết hạn — vẫn đăng xuất phía client */
    }
    resetSession();
  }, [resetSession]);

  const hasRole = useCallback((...roles: string[]) => !!user?.roles?.some((r) => roles.includes(r)), [user]);

  const value = useMemo(() => ({ user, status, login, logout, hasRole }), [user, status, login, logout, hasRole]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}
