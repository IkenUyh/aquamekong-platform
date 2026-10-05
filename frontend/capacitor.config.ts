import type { CapacitorConfig } from '@capacitor/cli';

// App Android/iOS bọc chính bản build web (dist/). Build bằng `npm run build:mobile`, xem README.
// CAPACITOR_ALLOW_HTTP=true: chỉ dùng khi thử với backend http:// trong mạng LAN (app chạy ở http://localhost).
const allowHttp = process.env.CAPACITOR_ALLOW_HTTP === 'true';

const config: CapacitorConfig = {
  appId: 'vn.aquamekong.app',
  appName: 'AquaMekong',
  webDir: 'dist',
  server: allowHttp ? { androidScheme: 'http', cleartext: true } : undefined,
  plugins: {
    // WebView nằm dưới thanh trạng thái, không tràn viền -> giao diện web không phải xử lý safe area
    SystemBars: { insetsHandling: 'native', style: 'LIGHT' },
    // Hiện thông báo cả khi đang mở app (mặc định Android chỉ hiện khi app ở nền)
    PushNotifications: { presentationOptions: ['sound', 'alert'] },
  },
};

export default config;
