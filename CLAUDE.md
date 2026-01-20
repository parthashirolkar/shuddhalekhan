# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Windows speech-to-text CLI application using whisper.cpp in Docker for GPU-accelerated transcription. The app provides push-to-talk functionality with global hotkeys and types text directly at the cursor position via Windows keyboard automation.

**Runtime**: Bun v1.3.5+ | **Entry Point**: `ts-version/src/index.ts` | **Model**: whisper.cpp ggml-large-v3-turbo.bin

## Common Commands

```bash
# Install dependencies
cd ts-version && bun install

# Run the application
bun run src/index.ts

# Build standalone executable (111MB)
bun build src/index.ts --compile --outfile speech-to-text.exe

# Type check
bunx tsc --noEmit

# Run tests (when implemented)
bun test tests/*.test.ts

# Run single test
bun test tests/*.test.ts --test-name-pattern "test_function_name"
```

## Architecture

The application follows a modular, class-based architecture with clear separation of concerns:

```
ts-version/src/
├── index.ts              # Main orchestrator - wires modules together
├── hotkey-manager.ts     # Global hotkey detection via @winput/keyboard
├── audio-recorder.ts     # Audio capture, resampling, WAV encoding
├── whisper-client.ts     # HTTP client to whisper.cpp Docker server
├── text-injector.ts      # Windows keyboard automation via @winput/keyboard
└── config.ts            # JSON config manager (~/.speech-2-text/config.json)
```

**Data Flow**: Hotkey Manager → Audio Recorder → WAV Buffer → Whisper Client → Text Injector

The main event loop (`index.ts:30-50`) registers an action callback that switches on recording actions:
- `start`: Initiates audio capture via node-cpal
- `stop_with_newline`: Stops recording, transcribes, injects text + newline
- `stop_without_newline`: Stops recording, transcribes, injects text only

## Audio Processing Pipeline

All audio processing is in-memory - no file I/O:

1. **Capture**: node-cpal records at device native rate (typically 48kHz)
2. **Resample**: Linear interpolation to 16kHz (Whisper requirement)
3. **Downmix**: Stereo → mono by averaging channels
4. **Encode**: Float32 samples → Int16 PCM, add 44-byte WAV header
5. **Transmit**: Multipart/form-data POST to whisper.cpp HTTP endpoint

Key constants in `audio-recorder.ts:3-5`:
- `TARGET_SAMPLE_RATE = 16000`
- `TARGET_CHANNELS = 1`
- `BYTES_PER_SAMPLE = 2`

## Native Modules

Two Node-API bindings are used:

- **@winput/keyboard**: Pure TypeScript library using Windows API via FFI (`node-ffi`)
  - `keyboard.listener.on.down()` for global hotkey detection
  - `keyboard.send()` and `keyboard.sendKey()` for text injection
  - Works with Bun's Node-API implementation

- **node-cpal**: Neon-based Rust binding for cross-platform audio capture
  - Provides `CpalHost` and `CpalStream` classes
  - Requires Bun's N-API support

Both are automatically bundled when building the executable.

## Docker Dependency

The app requires whisper.cpp running in Docker with GPU support:

```powershell
docker run -dit --name whisper-cuda-server --entrypoint /app/build/bin/whisper-server `
  -p 8080:8080 --gpus all `
  -v "D:\whisper\models:/app/models" `
  -e "GGML_CUDA=1" `
  ghcr.io/ggml-org/whisper.cpp:main-cuda-f53dc74843e97f19f94a79241357f74ad5b691a6 `
  --port 8080 --host 0.0.0.0 -m /app/models/ggml-large-v3-turbo.bin
```

HTTP endpoint: `POST http://localhost:8080/inference` with multipart/form-data containing `blob` (WAV file) and `temperature` fields.

## Code Style (from AGENTS.md)

- **Indentation**: 2 spaces, no semicolons
- **Imports**: Group as `node:` (stdlib), third-party, local with blank lines between; use `node:` prefix for built-ins
- **Naming**: `PascalCase` classes/types, `camelCase` functions, `UPPER_SNAKE_CASE` constants
- **Private members**: `private field` prefix (no underscore)
- **Logging**: Prefix with `[LEVEL]` - `[INFO]`, `[ERROR]`, `[WARNING]`, `[RECORDING]`, `[TRANSCRIBING]`, `[RESULT]`
- **Error handling**: Return `null` on failure, log to `console.error`, no throwing in user-facing code

## Configuration

Config file at `~/.speech-2-text/config.json` (auto-created with defaults):

```json
{
  "whisper": {
    "serverUrl": "http://localhost:8080/inference",
    "temperature": 0.2,
    "language": "en"
  },
  "audio": {
    "sampleRate": 16000,
    "channels": 1,
    "minDuration": 0.3
  },
  "hotkeys": {
    "start": ["ctrl", "win"],
    "stopWithNewline": "ctrl",
    "stopWithoutNewline": "alt"
  }
}
```

## TypeScript Configuration

- Target: ESNext, Module: Preserve (for Bun bundler)
- Strict mode enabled with `noUncheckedIndexedAccess`
- Module resolution: `bundler`
- No emission (handled by Bun compile)

See `AGENTS.md` for comprehensive code guidelines.
