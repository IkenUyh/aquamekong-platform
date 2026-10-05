import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pushApi } from '../api/pushApi';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { disablePush, enablePush, getPushDeviceState, pushAvailable, type PushDeviceState } from '../push/pushDevice';

export const PUSH_CONFIG_KEY = ['push', 'config'];

/**
 * Trạng thái thông báo đẩy của thiết bị đang dùng (chỉ khi đã đăng nhập).
 * available=false: máy chủ chưa cấu hình, hoặc trình duyệt/app không hỗ trợ.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const { data: config } = useQuery({ queryKey: PUSH_CONFIG_KEY, queryFn: pushApi.config, enabled: !!user, staleTime: Infinity });
  const [state, setState] = useState<PushDeviceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getPushDeviceState().then(setState).catch(() => setState('off'));
  }, [user]);

  const run = useCallback(async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  }, []);

  const enable = useCallback(() => run(async () => {
    if (!config) return;
    const next = await enablePush(config);
    setState(next);
    if (next === 'on') setMessage('Đã bật. Thiết bị này sẽ nhận thông báo khi có cảnh báo mới.');
  }, 'Không bật được thông báo, vui lòng thử lại.'), [config, run]);

  const disable = useCallback(() => run(async () => {
    await disablePush();
    setState('off');
  }, 'Không tắt được thông báo, vui lòng thử lại.'), [run]);

  const test = useCallback(() => run(async () => {
    const sent = await pushApi.test();
    setMessage(sent > 0 ? `Đã gửi thông báo thử tới ${sent} thiết bị.` : 'Không thiết bị nào nhận được, hãy tắt rồi bật lại thông báo.');
  }, 'Không gửi được thông báo thử.'), [run]);

  return {
    available: config ? pushAvailable(config) : false,
    state,
    busy,
    error,
    message,
    enable,
    disable,
    test,
  };
}
