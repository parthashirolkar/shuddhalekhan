# Project Decisions

## Product Name
- **Canonical**: **Shuddhalekhan** (Marathi: शुद्धलेखन)
- **Rationale**: Replaces the temporary "speech-2-text" identifier across the app, config, releases, and repository.

## Package Manager
- **Primary**: `bun` — chosen for install/build speed.
- **Fallback**: `pnpm` — to be adopted if `bun` causes resolution or native-addon issues (e.g., `koffi`).

## Build Tool
- **Frontend + Main + Preload**: `electron-vite` (Vite-based, preserves existing frontend build pipeline).

## Auto-Updater
- **Mechanism**: `electron-updater` with GitHub Releases.
- **Rationale**: Industry standard, no custom JSON endpoint or minisign key required. Build pipeline generates `latest.yml` automatically.

## Configuration
- **Library**: `electron-store` (typed, atomic, industry standard for Electron).
- **Legacy path**: `~/.speech-2-text/config.json` — to be migrated on first run if present.

## Decision Principle
- Prefer widely-documented, industry-standard libraries and patterns over custom solutions. This ensures future breakage is Google-able.

# Domain Glossary

## Core Concepts

### Recording Pill
The small floating UI window displayed at the bottom-center of the screen while recording is active. Rendered as a rounded pill shape with animated audio level bars. Exists in two visual modes:

- **Transcription Mode** — Blue-hued pill (border glow, shadow) indicating standard speech-to-text recording.
- **Agent Mode** — *(Discontinued in v3)* Red-hued pill indicating the recording will be routed to the AI agent for tool execution.

### Dictation
The act of converting captured audio into text and injecting it into the currently focused application. Triggered by holding the `Ctrl + Win` hotkey chord. Synonymous with "transcription mode" in user-facing language.

### Agent (Jarvis)
The local AI assistant that receives transcribed prompts, interprets them, and can execute system tools (open apps, adjust volume, take screenshots). Triggered by the `Alt + Win` hotkey chord. Communicates with a local Ollama instance.

### Text Injection
The process of simulating keystrokes to type transcribed text into the active window. Implemented via the **clipboard sandwich** pattern: save existing clipboard → write text → simulate paste (Ctrl+V) → restore original clipboard. Must not append Enter/newline by default.

## Technical Terms

### Audio Stream
A permanently initialized `cpal` input stream that buffers audio samples in memory. Recording toggles a `discard_audio` flag rather than starting/stopping the stream itself, enabling zero-latency capture.

### Whisper Client
HTTP client that sends recorded WAV audio to a configurable Whisper API endpoint (e.g., a local `whisper.cpp` server) and returns transcribed text.

### Approval Window
*(Discontinued in v3)* Modal popup displayed when the Agent requests to execute a sensitive tool. Requires explicit user confirmation before proceeding.

### Agent Response Window
*(Discontinued in v3)* Temporary toast-style window in the bottom-right corner that displays the Agent's text response. Auto-hides after 10 seconds.
