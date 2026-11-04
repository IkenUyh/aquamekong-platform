import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeZaloCallback, startZaloLogin } from './zaloOAuth';

// Môi trường test là node: giả lập sessionStorage và window.location
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

let assigned = '';
beforeEach(() => {
  assigned = '';
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173', assign: (url: string) => (assigned = url) } });
});
afterEach(() => vi.unstubAllGlobals());

async function start(intent: 'login' | 'link' = 'login', from = '/forecast') {
  await startZaloLogin('app-1', intent, from);
  return new URL(assigned);
}

describe('startZaloLogin', () => {
  it('redirects to Zalo with PKCE challenge and callback URL', async () => {
    const url = await start();
    expect(url.origin + url.pathname).toBe('https://oauth.zaloapp.com/v4/permission');
    expect(url.searchParams.get('app_id')).toBe('app-1');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/auth/zalo/callback');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('challenge is SHA-256 of the stored verifier', async () => {
    const url = await start();
    const result = consumeZaloCallback(`?code=c&state=${url.searchParams.get('state')}`);
    if (!result.ok) throw new Error('expected ok');
    expect(result.codeVerifier).toHaveLength(43);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(result.codeVerifier)));
    const expected = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(url.searchParams.get('code_challenge')).toBe(expected);
  });
});

describe('consumeZaloCallback', () => {
  it('returns code, verifier and where to go back', async () => {
    const url = await start('link', '/account');
    const result = consumeZaloCallback(`?code=abc&state=${url.searchParams.get('state')}`);
    expect(result).toMatchObject({ ok: true, code: 'abc', intent: 'link', from: '/account' });
  });

  it('rejects a mismatched state (CSRF)', async () => {
    await start();
    expect(consumeZaloCallback('?code=abc&state=forged')).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('rejects a callback that was not started from this browser', () => {
    expect(consumeZaloCallback('?code=abc&state=x')).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('treats a missing code as cancelled', async () => {
    const url = await start();
    expect(consumeZaloCallback(`?state=${url.searchParams.get('state')}`)).toMatchObject({ ok: false, reason: 'cancelled' });
  });

  it('can only be used once', async () => {
    const url = await start();
    const search = `?code=abc&state=${url.searchParams.get('state')}`;
    expect(consumeZaloCallback(search).ok).toBe(true);
    expect(consumeZaloCallback(search).ok).toBe(false);
  });
});
