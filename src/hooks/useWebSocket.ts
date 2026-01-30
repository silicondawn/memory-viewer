import { useEffect, useRef, useCallback } from "react";

type MessageHandler = (data: { type: string; event: string; path: string }) => void;

/**
 * Auto-reconnecting WebSocket hook for live file-change notifications.
 */
export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  const connect = useCallback(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      try {
        cbRef.current(JSON.parse(e.data));
      } catch { /* ignore bad json */ }
    };

    ws.onclose = () => {
      setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);
}
