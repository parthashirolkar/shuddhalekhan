import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupTray } from "./lib/tray";
import { setupHotkeys } from "./lib/hotkeys";

// Initialize tray on startup
setupTray().catch(console.error);
setupHotkeys().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
