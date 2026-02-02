import { useState, useEffect } from "react";

const ZOOM_KEY = "memory-viewer-zoom";
const ZOOM_LEVELS = [75, 80, 90, 100, 110, 125, 150];
const DEFAULT_ZOOM = 100;

export function useZoom() {
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem(ZOOM_KEY);
    return saved ? Number(saved) : DEFAULT_ZOOM;
  });

  useEffect(() => {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  }, [zoom]);

  return { zoom, setZoom, ZOOM_LEVELS };
}
