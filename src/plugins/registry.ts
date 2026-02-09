import { ComponentType } from "react";
import { MemoryViewerPlugin, PluginSlotName, SlotProps } from "./types";
import { getBaseUrl } from "../api";

const DISABLED_KEY = "mv-plugins-disabled";

class PluginRegistry {
  private plugins: Map<string, MemoryViewerPlugin> = new Map();
  private disabled: Set<string>;
  private listeners: Set<() => void> = new Set();
  private version = 0;

  constructor() {
    try {
      const raw = localStorage.getItem(DISABLED_KEY);
      this.disabled = new Set(raw ? JSON.parse(raw) : []);
    } catch {
      this.disabled = new Set();
    }
  }

  private notify() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  private persistDisabled() {
    localStorage.setItem(DISABLED_KEY, JSON.stringify([...this.disabled]));
  }

  register(plugin: MemoryViewerPlugin) {
    this.plugins.set(plugin.id, plugin);
    if (!this.disabled.has(plugin.id)) {
      plugin.onActivate?.();
    }
    this.notify();
  }

  unregister(id: string) {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.onDeactivate?.();
      this.plugins.delete(id);
      this.notify();
    }
  }

  enable(id: string) {
    this.disabled.delete(id);
    this.persistDisabled();
    this.plugins.get(id)?.onActivate?.();
    this.notify();
  }

  disable(id: string) {
    this.disabled.add(id);
    this.persistDisabled();
    this.plugins.get(id)?.onDeactivate?.();
    this.notify();
  }

  isEnabled(id: string): boolean {
    return !this.disabled.has(id);
  }

  getAll(): MemoryViewerPlugin[] {
    return [...this.plugins.values()];
  }

  getPluginsForSlot(slotName: PluginSlotName, filePath: string): ComponentType<SlotProps>[] {
    const result: ComponentType<SlotProps>[] = [];
    for (const plugin of this.plugins.values()) {
      if (this.disabled.has(plugin.id)) continue;
      const component = plugin.slots?.[slotName];
      if (!component) continue;
      if (plugin.fileFilter && !plugin.fileFilter(filePath)) continue;
      result.push(component);
    }
    return result;
  }

  /** Load external plugins from server */
  async loadExternal() {
    try {
      const res = await fetch(`${getBaseUrl()}/api/plugins`);
      const list: { id: string; name: string; entry: string }[] = await res.json();
      for (const info of list) {
        if (this.plugins.has(info.id)) continue;
        try {
          const url = `${getBaseUrl()}/api/plugins/${info.id}/${info.entry}`;
          const mod = await import(/* @vite-ignore */ url);
          const plugin: MemoryViewerPlugin = mod.default || mod.plugin;
          if (plugin?.id) {
            this.register(plugin);
          }
        } catch (e) {
          console.warn(`Failed to load external plugin "${info.id}":`, e);
        }
      }
    } catch {
      // No external plugins available
    }
  }

  // useSyncExternalStore compatible
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): number => {
    return this.version;
  };
}

export const pluginRegistry = new PluginRegistry();
