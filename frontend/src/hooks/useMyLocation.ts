import { useCallback, useState } from 'react';
import type { LatLng } from '../utils/geo';

const STORAGE_KEY = 'aquamekong.myLocation';

export type LocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';

function readSaved(): LatLng | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return typeof p?.lat === 'number' && typeof p?.lng === 'number' ? { lat: p.lat, lng: p.lng } : null;
  } catch {
    return null;
  }
}

function save(p: LatLng | null) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Trình duyệt chặn lưu trữ: lần sau hỏi lại vị trí
  }
}

/**
 * Vị trí của người dùng, chỉ lấy khi họ bấm nút. Vị trí chỉ nằm trên máy (localStorage, để lần sau khỏi hỏi lại),
 * không gửi lên máy chủ: trạm gần nhất tính ngay trên máy từ danh sách trạm.
 */
export function useMyLocation() {
  const [position, setPosition] = useState<LatLng | null>(readSaved);
  const [status, setStatus] = useState<LocationStatus>(() => (readSaved() ? 'ready' : 'idle'));

  /** onFound: gọi thêm khi có vị trí (vd. chọn luôn trạm gần nhất) */
  const locate = useCallback((onFound?: (p: LatLng) => void) => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        save(p);
        setPosition(p);
        setStatus('ready');
        onFound?.(p);
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      // Trạm cách nhau hàng km: vị trí theo mạng là đủ, nhanh hơn và ít tốn pin hơn GPS
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  const forget = useCallback(() => {
    save(null);
    setPosition(null);
    setStatus('idle');
  }, []);

  return { position, status, locate, forget };
}
