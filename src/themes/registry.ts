import { useSyncExternalStore, useCallback } from "react";
import type { MarkdownTheme } from "./types";

const STORAGE_KEY = "mv-md-theme";

class ThemeRegistry {
  private themes = new Map<MarkdownTheme["id"], MarkdownTheme>();
  private listeners = new Set<() => void>();
  private currentId: string;
  private snapshot = { version: 0 };

  constructor() {
    this.currentId = localStorage.getItem(STORAGE_KEY) || "medium";
  }

  register(theme: MarkdownTheme) {
    this.themes.set(theme.id, theme);
    this.notify();
  }

  get(id: string): MarkdownTheme | undefined {
    return this.themes.get(id);
  }

  list(): MarkdownTheme[] {
    return Array.from(this.themes.values());
  }

  getCurrent(): MarkdownTheme {
    return this.themes.get(this.currentId) || this.themes.get("default") || { id: "default", name: "Default" };
  }

  setCurrent(id: string) {
    if (this.currentId === id) return;
    this.currentId = id;
    localStorage.setItem(STORAGE_KEY, id);
    this.notify();
  }

  private notify() {
    this.snapshot = { version: this.snapshot.version + 1 };
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.snapshot;
}

export const themeRegistry = new ThemeRegistry();

export function useMarkdownTheme() {
  useSyncExternalStore(themeRegistry.subscribe, themeRegistry.getSnapshot);

  const setTheme = useCallback((id: string) => {
    themeRegistry.setCurrent(id);
  }, []);

  return {
    current: themeRegistry.getCurrent(),
    setTheme,
    themes: themeRegistry.list(),
  };
}
