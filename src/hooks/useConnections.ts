import { useState, useCallback, useEffect, useRef } from "react";

export interface BotConnection {
  id: string;
  name: string;
  url: string; // "" for local
  token?: string;
  isLocal?: boolean;
}

const STORAGE_KEY = "memory-viewer-connections";
const ACTIVE_KEY = "memory-viewer-active-connection";

const LOCAL_CONNECTION: BotConnection = {
  id: "local",
  name: "Local",
  url: "",
  isLocal: true,
};

function loadConnections(): BotConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw) as BotConnection[];
      // Ensure local is always first
      if (!list.find((c) => c.id === "local")) {
        list.unshift(LOCAL_CONNECTION);
      }
      return list;
    }
  } catch { /* ignore */ }
  return [LOCAL_CONNECTION];
}

function saveConnections(list: BotConnection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function useConnections() {
  const [connections, setConnections] = useState<BotConnection[]>(loadConnections);
  const [activeId, setActiveId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_KEY) || "local";
  });
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const active = connections.find((c) => c.id === activeId) || connections[0];

  const addConnection = useCallback((conn: Omit<BotConnection, "id">) => {
    const id = `bot-${Date.now()}`;
    setConnections((prev) => {
      const next = [...prev, { ...conn, id }];
      saveConnections(next);
      return next;
    });
  }, []);

  const updateConnection = useCallback((id: string, updates: Partial<BotConnection>) => {
    setConnections((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      saveConnections(next);
      return next;
    });
  }, []);

  const removeConnection = useCallback((id: string) => {
    if (id === "local") return;
    setConnections((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveConnections(next);
      return next;
    });
    setActiveId((prev) => (prev === id ? "local" : prev));
  }, []);

  const switchTo = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }, []);

  // Check connection statuses
  const checkStatuses = useCallback(async () => {
    const results: Record<string, boolean> = {};
    await Promise.all(
      connections.map(async (conn) => {
        if (conn.isLocal) {
          results[conn.id] = true;
          return;
        }
        try {
          const r = await fetch(`${conn.url.replace(/\/+$/, "")}/api/system`, {
            signal: AbortSignal.timeout(5000),
          });
          results[conn.id] = r.ok;
        } catch {
          results[conn.id] = false;
        }
      })
    );
    setStatuses(results);
  }, [connections]);

  useEffect(() => {
    checkStatuses();
    intervalRef.current = setInterval(checkStatuses, 30000);
    return () => clearInterval(intervalRef.current);
  }, [checkStatuses]);

  return {
    connections,
    active,
    statuses,
    addConnection,
    updateConnection,
    removeConnection,
    switchTo,
    checkStatuses,
  };
}
