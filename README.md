# Speech-2-Text (Tauri)

Windows tray-based speech-to-text app built with **Tauri (Rust backend + React frontend)**.  
Audio is recorded locally, transcribed via Whisper HTTP endpoint, and injected at the active cursor.

## Stack

- Frontend: React + TypeScript + Vite
- Desktop runtime: Tauri v2
- Backend: Rust (`src-tauri`)

## Project Layout

- `src/` React UI (recording popup + minimal main window)
- `src-tauri/src/` Rust app logic (audio, hotkeys, tray, whisper, text injection)
- `src-tauri/icons/` application and tray icons

## Development

Install JS dependencies:

```bash
bun install
```

Typecheck frontend:

```bash
bun run typecheck
```

Run Tauri app in dev mode:

```bash
bun run tauri dev
```

Build production app:

```bash
bun run tauri build
```

## Notes

- Recording popup is bottom-center and pill-shaped.
- Transcript injection is newline-safe (no Enter keypress is appended).
- Tray icon uses `src-tauri/icons/tray-icon.ico`.
