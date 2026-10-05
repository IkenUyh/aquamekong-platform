import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // App điện thoại (Capacitor) không có nginx proxy /api -> phải biết địa chỉ tuyệt đối của backend
  if (mode === 'mobile' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL) {
    throw new Error('Build mobile cần VITE_API_BASE_URL (vd. https://aquamekong.vn), đặt trong .env.mobile.local');
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      // Không đóng source map vào gói app
      sourcemap: mode !== 'mobile',
    },
  };
});
