# AGENTS.md — Shuddhalekhan

## Stale docs warning
- **README.md and `.github/workflows/release.yml` are stale** — they still reference Tauri. The app was migrated to Electron. Do not trust anything Tauri-related in those files. `src-tauri/` does not exist.

## Platform
- **Windows-only**. The app uses `koffi` to call `user32.dll` / `kernel32.dll` for global keyboard hooks and clipboard paste simulation. Will not run on macOS/Linux.

## Commands
| Purpose     | Command                          |
|-------------|----------------------------------|
| Dev         | `bun run dev`                    |
| Build       | `bun run build`                  |
| Typecheck   | `bun run typecheck`              |
| Lint        | `bun run lint`                   |
| Lint fix    | `bun run lint:fix`               |
| Package     | `bun run dist`                   |
| Install     | `bun install`                    |

Use `bun` exclusively. `pnpm` is only a fallback if `koffi` causes resolution issues.

## Build architecture
- **electron-vite** with three targets defined in `electron.vite.config.ts`:
  - `main` — entry `src/main/index.ts`, output CJS (`out/main/index.cjs`)
  - `preload` — entry `src/preload/index.ts`, output CJS (`out/preload/index.cjs`)
  - `renderer` — Vite + React, entry `src/renderer/main.tsx`, alias `@renderer` → `src/renderer/`

## IPC
- All IPC channel types are in `src/types/ipc.ts`. Channels must stay in sync between `src/preload/index.ts` and `src/main/index.ts`.
- Pattern: `invoke` for request/response, `send`/`on` for events.
- Preload exposes `window.electronAPI` with typed `invoke`, `send`, `on`.

## Native layer
- `src/main/native/keyboard.ts` — global low-level keyboard hook via `koffi`. Ctrl+Win chord toggles recording.
- `src/main/native/clipboard.ts` — `SendInput`-based Ctrl+V paste simulation via `koffi`.

## Config
- `electron-store` with store name `shuddhalekhan-config`.
- Legacy config path `~/.speech-2-text/config.json` is auto-migrated on first run (see `src/main/config.ts`).

## Lint rules
- `@typescript-eslint/no-unused-vars` is error-level with `argsIgnorePattern: '^_'`.
- `@typescript-eslint/no-explicit-any` is off.
- `out/`, `release/`, `node_modules/`, `src-tauri/`, and `*.config.{ts,mjs}` are ignored.

## No tests
- There are no test scripts or test files. Run lint + typecheck as pre-commit verification.
