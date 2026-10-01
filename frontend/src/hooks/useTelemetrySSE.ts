import { useEffect, useRef, useState } from 'react';
import type { TelemetryEvent } from '../types';
import { getToken } from '../auth/tokenStorage';

const SSE_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/telemetry/stream`;
const RECONNECT_DELAY_MS = 5000;

interface UseTelemetrySSEOptions {
  onTelemetry?: (data: TelemetryEvent) => void;
  onInit?: (data: TelemetryEvent[]) => void;
  enabled?: boolean;
}

export function useTelemetrySSE({ onTelemetry, onInit, enabled = true }: UseTelemetrySSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<TelemetryEvent | null>(null);

  // Callback giữ trong ref: đổi callback không làm đóng/mở lại kết nối SSE
  const onTelemetryRef = useRef(onTelemetry);
  const onInitRef = useRef(onInit);
  onTelemetryRef.current = onTelemetry;
  onInitRef.current = onInit;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      // EventSource không gửi được header Authorization -> token qua query param (chỉ endpoint SSE nhận)
      const token = getToken();
      es = new EventSource(token ? `${SSE_URL}?access_token=${encodeURIComponent(token)}` : SSE_URL);

      es.onopen = () => setIsConnected(true);

      es.addEventListener('init', (event) => {
        try {
          onInitRef.current?.(JSON.parse((event as MessageEvent).data) as TelemetryEvent[]);
        } catch (e) {
          console.error('[SSE] Failed to parse init data', e);
        }
      });

      es.addEventListener('telemetry', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as TelemetryEvent;
          setLastEvent(data);
          onTelemetryRef.current?.(data);
        } catch (e) {
          console.error('[SSE] Failed to parse telemetry data', e);
        }
      });

      es.onerror = () => {
        setIsConnected(false);
        es?.close();
        if (!disposed) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected, lastEvent };
}
