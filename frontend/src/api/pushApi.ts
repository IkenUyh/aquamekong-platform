import apiClient from './client';

/** GET /push/config */
export interface PushConfig {
  /** Khoá VAPID cho trình duyệt; null = máy chủ chưa bật Web Push */
  webPushPublicKey: string | null;
  /** Máy chủ gửi được tới app điện thoại (Firebase) */
  fcmEnabled: boolean;
}

export interface PushSubscribeRequest {
  channel: 'WEBPUSH' | 'FCM';
  /** WEBPUSH: endpoint của trình duyệt. FCM: token của app */
  endpoint: string;
  p256dh?: string;
  auth?: string;
}

export const pushApi = {
  config: () => apiClient.get<PushConfig>('/push/config').then((r) => r.data),
  subscribe: (req: PushSubscribeRequest) => apiClient.post('/push/subscriptions', req),
  unsubscribe: (endpoint: string) => apiClient.post('/push/unsubscribe', { endpoint }),
  /** Gửi thông báo thử tới mọi thiết bị của tài khoản, trả về số thiết bị nhận được */
  test: () => apiClient.post<{ sent: number }>('/push/test').then((r) => r.data.sent),
};
