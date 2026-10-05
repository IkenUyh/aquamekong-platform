import { Capacitor } from '@capacitor/core';

/** true khi chạy trong app Android/iOS (Capacitor), false trên trình duyệt */
export const isNativeApp = Capacitor.isNativePlatform();
