import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./themes";
import App from "./App";
import { pluginRegistry } from "./plugins/registry";
import { wechatCopyPlugin } from "./plugins/wechat-copy";

pluginRegistry.register(wechatCopyPlugin);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
