# AGENTS.md

This file provides guidelines for agentic coding tools working in this repository.

---

## Project Overview

Tauri-based speech-to-text system tray application with React frontend and Rust backend.
- **Frontend Entry Point**: `src/main.tsx`
- **Desktop Entry Points**: `src-tauri/src/main.rs` and `src-tauri/src/lib.rs`
- **Runtime**: Tauri v2 + Bun for frontend tooling

---

## Build, Lint, Test Commands

```bash
# Install dependencies
bun install

# Lint code
bun run lint

# Fix lint issues
bun run lint:fix

# Type check frontend
bun run typecheck

# Check Rust backend
cd src-tauri && cargo check

# Run app in development
bun run tauri dev
```

---

**Key points**:
- Tray icon path is `src-tauri/icons/tray-icon.ico`.
- Recording popup UI is rendered from React (`src/RecordingPopup.tsx`) inside the Tauri `recording` window.
- Text injection must not append Enter/newline by default.
