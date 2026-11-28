import { useCallback, useSyncExternalStore } from 'react';
import {
  CHOICE_KEY, MODE_KEY, readFarmerState, writeFarmerChoice, writeFarmerMode, type FarmerChoice, type FarmerState,
} from '../utils/farmerMode';

// Một bản trạng thái dùng chung cho mọi component (Navbar, BottomNav, router, trang Nông dân)
let state: FarmerState = readFarmerState();
const listeners = new Set<() => void>();

function refresh() {
  state = readFarmerState();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Đổi ở tab khác
  const onStorage = (e: StorageEvent) => {
    if (e.key === MODE_KEY || e.key === CHOICE_KEY) refresh();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const getSnapshot = () => state;

/** Chế độ Nông dân (mặc định tắt) và lựa chọn trạm + cây đã lưu trên máy */
export function useFarmerMode() {
  const { on, choice } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setOn = useCallback((value: boolean) => {
    writeFarmerMode(value);
    refresh();
  }, []);
  const setChoice = useCallback((value: FarmerChoice | null) => {
    writeFarmerChoice(value);
    refresh();
  }, []);
  return { on, choice, setOn, setChoice };
}
