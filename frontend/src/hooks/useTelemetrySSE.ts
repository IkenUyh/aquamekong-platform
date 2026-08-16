import { useEffect, useRef, useCallback, useState } from 'react';
import type { TelemetryEvent } from '../types';

const SSE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/v1/telemetry/stream`;

interface UseTelemetrySSEOptions {
  onTelemetry?: (data: TelemetryEvent) => void;
  onInit?: (data: TelemetryEvent[]) => void;
  enabled?: boolean;
}

export function useTelemetrySSE({ onTelemetry, onInit, enabled = true }: UseTelemetrySSEOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<TelemetryEvent | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(SSE_URL);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      console.log('[SSE] Connected to telemetry stream');
    };

    // Handle initial data event
    es.addEventListener('init', (event) => {
      try {
        const data = JSON.parse(event.data) as TelemetryEvent[];
        onInit?.(data);
        console.log('[SSE] Received initial data:', data.length, 'metrics');
      } catch (e) {
        console.error('[SSE] Failed to parse init data', e);
      }
    });

    // Handle telemetry updates
    es.addEventListener('telemetry', (event) => {
      try {
        const data = JSON.parse(event.data) as TelemetryEvent;
        setLastEvent(data);
        onTelemetry?.(data);
      } catch (e) {
        console.error('[SSE] Failed to parse telemetry data', e);
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      console.warn('[SSE] Connection lost. Reconnecting in 5s...');

      // Auto-reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) connect();
      }, 5000);
    };
  }, [onTelemetry, onInit, enabled]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, enabled]);

  return { isConnected, lastEvent };
}
