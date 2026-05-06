# Shuddhalekhan

Windows tray-based speech-to-text dictation app built with Electron and React.
Audio is recorded locally, sent to a Whisper-compatible HTTP endpoint, and injected at the active cursor.

Hold `Ctrl+Win` to record. Release the chord to stop recording, transcribe the captured audio, and paste the transcript into the focused application.

## Stack

- Frontend: React + TypeScript + Vite
- Desktop runtime: Electron
- Native Windows integration: Koffi

## Project Layout

- `src/renderer/` React UI (recording popup + hidden audio window)
- `src/main/` Electron main process logic (hotkey, tray, Whisper, text injection)
- `src/preload/` IPC bridge
- `icons/` application and tray icons

## Development

Install JS dependencies:

```bash
bun install
```

Typecheck:

```bash
bun run typecheck
```

Lint:

```bash
bun run lint
```

Run tests:

```bash
bun test
```

Run Electron app in dev mode:

```bash
bun run dev
```

Build production app artifacts locally:

```bash
bun run dist
```

The GitHub release workflow runs lint, typecheck, tests, build, and Electron Builder packaging on `windows-latest`.

## Whisper Server Setup

The application requires a Whisper-compatible HTTP endpoint to transcribe audio. By default it posts to:

```text
http://localhost:8080/inference
```

The request is sent as `multipart/form-data` with a WAV `file`, `temperature=0.2`, and `response_format=json`. When transcription cleanup is enabled, a cleanup `prompt` field is also included.

### Option 1: Local whisper.cpp with Docker (Recommended)

**Requirements:**
- Docker Desktop with GPU support
- NVIDIA GPU with CUDA (RTX 4060 or higher recommended)

**One-time Setup:**

1. **Create model directory:**
   ```powershell
   New-Item -Path "C:\whisper\models" -ItemType Directory -Force
   ```

2. **Download quantized model (Q5_0, 574 MB):**
   ```powershell
   curl -L -o "C:\whisper\models\ggml-large-v3-turbo-q5_0.bin" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
   ```

3. **Start whisper.cpp Docker container:**
   ```powershell
   docker run -dit --name whisper-cuda-server --entrypoint /app/build/bin/whisper-server `
     -p 8080:8080 --gpus all `
     -v "C:\whisper\models:/app/models" `
     -e "LD_LIBRARY_PATH=/usr/local/cuda-13.0/lib64:/usr/local/cuda-13.0/compat/lib64" `
     -e "GGML_CUDA=1" `
     --restart unless-stopped `
     ghcr.io/ggml-org/whisper.cpp:main-cuda-f53dc74843e97f19f94a79241357f74ad5b691a6 `
     --port 8080 --host 0.0.0.0 -m /app/models/ggml-large-v3-turbo-q5_0.bin
   ```

**⚠️ IMPORTANT:** The `LD_LIBRARY_PATH` environment variable is critical for CUDA GPU detection. Without it, the container falls back to CPU-only mode.

**Start server on reboot:**
```powershell
docker start whisper-cuda-server
```

### Option 2: OpenAI Whisper API

The app's current Whisper client does not include request-header configuration, so hosted APIs that require authentication need code changes before they can be used directly.

### Option 3: Other Whisper Providers

The app works with any compatible unauthenticated endpoint that accepts the same multipart WAV upload shape, such as:
- LocalAI
- Self-hosted whisper.cpp instances

## Notes

- The app is Windows-only because global keyboard hooks and paste simulation call Windows APIs through `koffi`.
- Recording is controlled by the global `Ctrl+Win` chord.
- The tray menu supports microphone selection, transcription cleanup toggling, manual update checks, and exit.
- Recording popup is bottom-center and pill-shaped.
- Transcript injection is newline-safe (no Enter keypress is appended).
- Tray icon uses `icons/tray-icon.ico`.
- Active configuration is stored with `electron-store` under the `shuddhalekhan-config` store name.
- Updates are packaged with Electron Builder and checked with `electron-updater`.
