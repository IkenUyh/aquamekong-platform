/**
 * Đăng nhập Zalo (OAuth v4 + PKCE): sinh code_verifier, chuyển sang trang cấp quyền của Zalo,
 * Zalo trả `code` + `state` về /auth/zalo/callback. Backend đổi code lấy token bằng app secret.
 */
const PERMISSION_URL = 'https://oauth.zaloapp.com/v4/permission';
const PENDING_KEY = 'aquamekong.zaloPending';
export const ZALO_CALLBACK_PATH = '/auth/zalo/callback';

export type ZaloIntent = 'login' | 'link';

interface Pending {
  state: string;
  codeVerifier: string;
  intent: ZaloIntent;
  /** Trang quay lại sau khi xong */
  from: string;
}

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomString = (byteLength: number) => base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));

/** crypto.subtle chỉ có ở HTTPS hoặc localhost */
export const zaloSupported = () => typeof crypto !== 'undefined' && !!crypto.subtle;

export async function startZaloLogin(appId: string, intent: ZaloIntent, from: string): Promise<void> {
  if (!zaloSupported()) throw new Error('Đăng nhập Zalo cần trang chạy bằng HTTPS.');
  const codeVerifier = randomString(32); // 43 ký tự
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const pending: Pending = { state: randomString(16), codeVerifier, intent, from };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: window.location.origin + ZALO_CALLBACK_PATH,
    code_challenge: base64Url(new Uint8Array(digest)),
    state: pending.state,
  });
  window.location.assign(`${PERMISSION_URL}?${params}`);
}

export type ZaloCallback =
  | { ok: true; code: string; codeVerifier: string; intent: ZaloIntent; from: string }
  | { ok: false; reason: 'cancelled' | 'invalid'; intent: ZaloIntent; from: string };

/** Đọc kết quả trên URL callback; chỉ dùng được một lần (xoá dữ liệu PKCE đã lưu) */
export function consumeZaloCallback(search: string): ZaloCallback {
  let pending: Pending | null = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* sessionStorage bị chặn */
  }
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const intent = pending?.intent ?? 'login';
  const from = pending?.from ?? (intent === 'link' ? '/account' : '/');
  // state khác -> callback không xuất phát từ lần bấm nút của chính người này (chống CSRF)
  if (!pending || params.get('state') !== pending.state) return { ok: false, reason: 'invalid', intent, from };
  if (!code) return { ok: false, reason: 'cancelled', intent, from };
  return { ok: true, code, codeVerifier: pending.codeVerifier, intent, from };
}
