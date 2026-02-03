import { useState, useEffect, useCallback, useRef } from "react";

const SIDEBAR_WIDTH_KEY = "memory-viewer-sidebar-width";
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

export function useResizableSidebar() {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? Number(saved) : DEFAULT_WIDTH;
  });
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }, [width]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging.current) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + clientX - startX.current));
    setWidth(newWidth);
  }, []);

  const handleEnd = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // Mouse events
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => {
      handleEnd();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [width, handleMove, handleEnd]);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDragging.current = true;
    startX.current = e.touches[0].clientX;
    startWidth.current = width;

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      handleEnd();
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };

    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
  }, [width, handleMove, handleEnd]);

  return { width, onMouseDown, onTouchStart, MIN_WIDTH, MAX_WIDTH };
}
