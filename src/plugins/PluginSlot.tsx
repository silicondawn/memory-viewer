import { useSyncExternalStore, RefObject } from "react";
import { pluginRegistry } from "./registry";
import { PluginSlotName } from "./types";

interface PluginSlotProps {
  name: PluginSlotName;
  filePath: string;
  content: string;
  renderedRef: RefObject<HTMLElement | null>;
}

export function PluginSlot({ name, filePath, content, renderedRef }: PluginSlotProps) {
  const version = useSyncExternalStore(pluginRegistry.subscribe, pluginRegistry.getSnapshot);
  const components = pluginRegistry.getPluginsForSlot(name, filePath);

  if (components.length === 0) return null;

  return (
    <>
      {components.map((Component, i) => (
        <Component key={`${name}-${i}-${version}`} filePath={filePath} content={content} renderedRef={renderedRef} />
      ))}
    </>
  );
}
