import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupTray } from "./lib/tray";
import { setupHotkeys } from "./lib/hotkeys";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

// Only initialize tray and hotkeys from the main window
// to prevent duplicates when the recording popup window loads
if (getCurrentWebviewWindow().label === "main") {
  setupTray().catch(console.error);
  setupHotkeys().catch(console.error);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
