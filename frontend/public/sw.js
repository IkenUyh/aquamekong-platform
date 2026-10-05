// Service worker chỉ để nhận thông báo đẩy (Web Push) khi có cảnh báo mới. Không cache trang.
// Nội dung do backend gửi (PushService): { title, body, url, tag }.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'AquaMekong', {
      body: data.body || '',
      // Cùng tag thì thông báo mới thay thông báo cũ, không xếp chồng
      tag: data.tag,
      data: { url: data.url || '/alerts' },
      lang: 'vi',
    })
  );
});

// Bấm vào thông báo: mở trang cảnh báo, dùng lại tab đang mở nếu có
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/alerts', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const tab = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (!tab) return self.clients.openWindow(url);
      return tab.focus().then((w) => w.navigate(url)).catch(() => self.clients.openWindow(url));
    })
  );
});
