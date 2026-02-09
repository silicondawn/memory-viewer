import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./themes";
import App from "./App";
import { pluginRegistry } from "./plugins/registry";

// Load external plugins (non-blocking)
pluginRegistry.loadExternal();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
