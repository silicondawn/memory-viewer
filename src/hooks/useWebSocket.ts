import { useEffect, useRef, useCallback } from "react";

type MessageHandler = (data: { type: string; event: string; path: string }) => void;

/**
 * Auto-reconnecting WebSocket hook for live file-change notifications.
 * Supports dynamic URL for remote connections.
 */
export function useWebSocket(onMessage: MessageHandler, remoteBaseUrl = "") {
  const wsRef = useRef<WebSocket | null>(null);
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  const connect = useCallback(() => {
    let wsUrl: string;
    if (remoteBaseUrl) {
      // Convert http(s)://host:port to ws(s)://host:port/ws
      const url = new URL(remoteBaseUrl);
      const proto = url.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${proto}//${url.host}/ws`;
    } else {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${proto}//${location.host}/ws`;
    }
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
  }, [remoteBaseUrl]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);
}
