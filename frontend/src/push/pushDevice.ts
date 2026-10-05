import type { PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { pushApi, type PushConfig } from '../api/pushApi';
import { isNativeApp } from '../platform';

/**
 * Bật/tắt thông báo đẩy trên thiết bị đang dùng.
 * Trình duyệt: Web Push qua service worker (public/sw.js). App điện thoại: FCM qua @capacitor/push-notifications.
 */

/** on/off: thiết bị này đang/không nhận thông báo. denied: người dùng đã chặn quyền thông báo. */
export type PushDeviceState = 'on' | 'off' | 'denied';

const FCM_TOKEN_KEY = 'aquamekong.fcmToken';

/** Trình duyệt hỗ trợ Web Push (iOS: chỉ khi đã "Thêm vào màn hình chính") */
export function webPushSupported(): boolean {
  return !isNativeApp && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Thiết bị này bật được thông báo với cấu hình máy chủ hiện tại không */
export function pushAvailable(config: PushConfig): boolean {
  return isNativeApp ? config.fcmEnabled : webPushSupported() && config.webPushPublicKey != null;
}

export async function getPushDeviceState(): Promise<PushDeviceState> {
  if (isNativeApp) {
    const { receive } = await PushNotifications.checkPermissions();
    if (receive === 'denied') return 'denied';
    return receive === 'granted' && readFcmToken() ? 'on' : 'off';
  }
  if (!webPushSupported()) return 'off';
  if (Notification.permission === 'denied') return 'denied';
  const subscription = await currentWebSubscription();
  return subscription && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Xin quyền, đăng ký với dịch vụ push rồi báo backend. Trả 'denied' nếu người dùng từ chối. */
export async function enablePush(config: PushConfig): Promise<PushDeviceState> {
  return isNativeApp ? enableNative() : enableWeb(config.webPushPublicKey!);
}

/** Tắt trên thiết bị này. Lỗi phía backend (vd. token hết hạn) không chặn việc huỷ đăng ký trên máy. */
export async function disablePush(): Promise<void> {
  if (isNativeApp) {
    const token = readFcmToken();
    if (token) await pushApi.unsubscribe(token).catch(() => undefined);
    await PushNotifications.unregister().catch(() => undefined);
    writeFcmToken(null);
    return;
  }
  const subscription = await currentWebSubscription();
  if (!subscription) return;
  await pushApi.unsubscribe(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}

/** App điện thoại: bấm vào thông báo thì mở trang tương ứng (mặc định /alerts). Gọi một lần lúc khởi động. */
export function openPageOnNotificationTap(navigate: (url: string) => void) {
  if (!isNativeApp) return;
  void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url;
    navigate(typeof url === 'string' && url.startsWith('/') ? url : '/alerts');
  });
}

async function enableWeb(vapidPublicKey: string): Promise<PushDeviceState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const serverKey = base64UrlToBytes(vapidPublicKey);
  let subscription = await registration.pushManager.getSubscription();
  // Máy chủ đổi khoá VAPID: đăng ký cũ không nhận được nữa, phải đăng ký lại
  if (subscription && !sameBytes(subscription.options.applicationServerKey, serverKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });

  const json = subscription.toJSON();
  await pushApi.subscribe({ channel: 'WEBPUSH', endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
  return 'on';
}

async function enableNative(): Promise<PushDeviceState> {
  let { receive } = await PushNotifications.checkPermissions();
  if (receive === 'prompt' || receive === 'prompt-with-rationale') {
    ({ receive } = await PushNotifications.requestPermissions());
  }
  if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'off';

  const token = await registerFcmToken();
  await pushApi.subscribe({ channel: 'FCM', endpoint: token });
  writeFcmToken(token);
  return 'on';
}

/** Đăng ký với Firebase, chờ token qua listener 'registration' */
async function registerFcmToken(): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const handles: Promise<PluginListenerHandle>[] = [];
  try {
    return await new Promise<string>((resolve, reject) => {
      handles.push(PushNotifications.addListener('registration', (t) => resolve(t.value)));
      handles.push(PushNotifications.addListener('registrationError', (e) => reject(new Error(e.error))));
      // Firebase không trả lời (thiếu google-services.json, không có mạng)
      timer = setTimeout(() => reject(new Error('Hết thời gian chờ đăng ký thông báo')), 15000);
      PushNotifications.register().catch(reject);
    });
  } finally {
    clearTimeout(timer);
    handles.forEach((h) => void h.then((l) => l.remove()));
  }
}

async function currentWebSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function readFcmToken(): string | null {
  try {
    return localStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeFcmToken(token: string | null) {
  try {
    if (token) localStorage.setItem(FCM_TOKEN_KEY, token);
    else localStorage.removeItem(FCM_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameBytes(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}
