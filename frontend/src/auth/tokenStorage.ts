const TOKEN_KEY = 'aquamekong.accessToken';

/** Sự kiện phát ra khi API trả 401 -> AuthContext đưa người dùng về trang đăng nhập. */
export const UNAUTHORIZED_EVENT = 'aquamekong:unauthorized';

// localStorage có thể bị chặn (private mode, cookie bị tắt) -> không được làm hỏng app
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
