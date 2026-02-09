import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./themes";
import App from "./App";
import { pluginRegistry } from "./plugins/registry";

// Expose React for external plugins
(window as any).__MV_REACT__ = React;

// Load external plugins (non-blocking)
pluginRegistry.loadExternal();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
