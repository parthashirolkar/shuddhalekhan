# Speech-2-Text (Electron)

Windows tray-based speech-to-text app built with **Electron + React**.
Audio is recorded locally, transcribed via Whisper HTTP endpoint, and injected at the active cursor.

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

Run Electron app in dev mode:

```bash
bun run dev
```

Build production app:

```bash
bun run dist
```

## Whisper Server Setup

The application requires a Whisper HTTP endpoint to transcribe audio. You can use:

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

Use OpenAI's hosted Whisper API:

1. Get an API key from https://platform.openai.com/api-keys
2. Configure the app's Whisper URL to: `https://api.openai.com/v1/audio/transcriptions`
3. Set your API key in the request headers (requires code modification)

### Option 3: Other Whisper Providers

The app works with any OpenAI-compatible Whisper endpoint, such as:
- LocalAI
- LocalAI
- Self-hosted whisper.cpp instances
- Cloud providers offering Whisper APIs

## Notes

- Recording popup is bottom-center and pill-shaped.
- Transcript injection is newline-safe (no Enter keypress is appended).
- Tray icon uses `icons/tray-icon.ico`.
- Active configuration is stored by Electron. Legacy `~/.speech-2-text/config.json` is migrated on first run.
