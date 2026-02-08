import { RefObject, ComponentType } from "react";

export interface SlotProps {
  filePath: string;
  content: string;
  renderedRef: RefObject<HTMLElement | null>;
}

export type PluginSlotName = 'fileviewer-toolbar' | 'fileviewer-footer' | 'sidebar-bottom';

export interface MemoryViewerPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  onActivate?: () => void;
  onDeactivate?: () => void;
  slots?: Partial<Record<PluginSlotName, ComponentType<SlotProps>>>;
  fileFilter?: (filePath: string) => boolean;
}
