# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**शुद्धलेखन (Shuddhlekhan)** - A Windows speech-to-text system tray application using whisper.cpp in Docker for GPU-accelerated transcription. The app provides push-to-talk functionality with global hotkeys and types text directly at the cursor position via Windows keyboard automation. Runs as a headless GUI application with system tray icon and logging.

**Runtime**: Bun v1.3.5+ | **Entry Point**: `ts-version/src/index.ts` | **Model**: whisper.cpp ggml-large-v3-turbo.bin

## Common Commands

```bash
# Install dependencies
cd ts-version && bun install

# Run the application (development mode)
bun run src/index.ts

# Build standalone executable with console (for testing)
bun run build

# Build headless GUI executable (recommended for production)
bun run build:headless

# Run with debug console enabled
$env:DEBUG="true"; .\speech-to-text.exe

# Type check
bunx tsc --noEmit
```

## Build Scripts

- `bun run build` - Standard build with console window
- `bun run build:headless` - GUI subsystem build using editbin (no console window)

The headless build uses `build-headless.ps1` which:
1. Builds the executable with Bun
2. Searches for Visual Studio's `editbin.exe`
3. Changes executable subsystem to WINDOWS (GUI mode)
4. Silently continues if editbin is not found

## Architecture

The application follows a modular, class-based architecture with clear separation of concerns:

```
ts-version/src/
├── index.ts                 # Main orchestrator - wires modules together
├── hotkey-manager.ts        # Global hotkey detection via @winput/keyboard
├── audio-recorder.ts        # Audio capture, resampling, WAV encoding
├── audio-device-manager.ts  # Audio device enumeration via node-cpal
├── whisper-client.ts        # HTTP client to whisper.cpp Docker server
├── text-injector.ts         # Windows keyboard automation via @winput/keyboard
├── config.ts              # JSON config manager (~/.speech-2-text/config.json)
├── logger.ts              # Centralized logging to file and console
└── tray-manager.ts        # Windows system tray integration with systray2
```

**Data Flow**: Hotkey Manager → Audio Recorder → WAV Buffer → Whisper Client → Text Injector

**UI Flow**: User interacts via:
- Global hotkeys (Ctrl+Win to record)
- System tray icon (right-click menu)

The main event loop (`index.ts:39-70`) registers an action callback that switches on recording actions:
- `start`: Initiates audio capture via node-cpal, updates tray to "Recording..."
- `stop_with_newline`: Stops recording, transcribes, injects text + newline
- `stop_without_newline`: Stops recording, transcribes, injects text only

All events update the system tray status and log to `~/.speech-2-text/app.log`.

## Audio Processing Pipeline

All audio processing is in-memory - no file I/O:

1. **Device Selection**: Optional device ID passed to `initialize()` or defaults to system device
2. **Capture**: node-cpal records at device native rate (typically 48kHz stereo)
3. **Resample**: Linear interpolation to 16kHz (Whisper requirement)
4. **Downmix**: Stereo → mono by averaging channels
5. **Encode**: Float32 samples → Int16 PCM, add 44-byte WAV header
6. **Transmit**: Multipart/form-data POST to whisper.cpp HTTP endpoint

Key constants in `audio-recorder.ts:4-6`:
- `SAMPLE_RATE = 16000`
- `CHANNELS = 1`
- Implicit: 2 bytes per sample (Int16 PCM)

### Audio Device Management

The `AudioDeviceManager` class (`audio-device-manager.ts`) handles device enumeration:
- Uses node-cpal's `getDevices()` API to list all audio devices
- Filters for input devices (capture devices)
- Returns `AudioDevice[]` with `{ id, name, isDefault }` structure
- Validates device IDs before selection

Device switching flow:
1. User selects device from system tray dialog (PowerShell Windows Forms)
2. `TrayManager.selectDevice()` updates config and calls `audioRecorder.reinitialize(deviceId)`
3. `AudioRecorder.reinitialize()` shuts down existing stream and creates new one with selected device
4. New device is persisted to config for next startup

## Native Modules

Two Node-API bindings are used:

- **@winput/keyboard**: Pure TypeScript library using Windows API via FFI (`node-ffi`)
  - `keyboard.listener.on.down()` for global hotkey detection
  - `keyboard.send()` and `keyboard.sendKey()` for text injection
  - Works with Bun's Node-API implementation

- **node-cpal**: Neon-based Rust binding for cross-platform audio capture
  - Provides `CpalHost` and `CpalStream` classes
  - Requires Bun's N-API support
  - **Device enumeration**: Use `(cpal as any).getDevices()` to list all audio devices
  - **Device selection**: Pass device ID to `cpal.createStream(deviceId, ...)` for specific device

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
- **Logging**: Use centralized `logger` from `./logger.ts`:
  - `logger.info()` for general info
  - `logger.error()` for errors
  - `logger.warning()` for warnings
  - `logger.recording()` for recording events
  - `logger.transcribing()` for transcription events
  - `logger.result()` for results
- **Error handling**: Return `null` on failure, log via `logger.error()`, no throwing in user-facing code

## Logging

All logging is centralized in `logger.ts`:
- **File output**: `~/.speech-2-text/app.log` (rotated when > 1MB)
- **Console output**: In development or when `DEBUG="true"` is set
- **Log levels**: INFO, WARNING, ERROR, RECORDING, TRANSCRIBING, RESULT, PERF

```typescript
import { logger } from "./logger.ts"

logger.info("Application started")
logger.error("Failed to connect to server")
logger.recording("Started recording")
```

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
    "minDuration": 0.3,
    "deviceId": "",
    "deviceName": ""
  },
  "hotkeys": {
    "start": ["ctrl", "win"],
    "stopWithNewline": "ctrl",
    "stopWithoutNewline": "alt"
  }
}
```

- `deviceId` and `deviceName`: Persist selected audio input device (optional)
- Empty `deviceId` means use system default device
- Device selection available via system tray menu

Logs are written to `~/.speech-2-text/app.log`.

## System Tray

The application runs as a Windows GUI application with a system tray icon:
- **Icon**: `ts-version/tray-icon.ico` (must be in same directory as executable)
- **Library**: systray2 with `copyDir: true` for icon bundling
- **Menu items**:
  - Status (dynamic: "Ready to record", "Recording...", "Transcribing...")
  - Choose Input Device... (opens dialog to select audio device)
  - Edit Config File
  - Open Config Folder
  - View Logs
  - About
  - Exit
- **Dynamic updates**: Status changes during recording/transcription
- **Device switching**: TrayManager receives AudioRecorder reference and calls `reinitialize(deviceId)` when device changes
- **Exit handling**: Clean shutdown via tray menu or Ctrl+C (development only)

**Note**: When building for production, ensure `tray-icon.ico` is copied alongside the executable. The `build:headless` script does not automatically copy the icon file.

### PowerShell Dialogs

For device selection and notifications, the app uses PowerShell with Windows Forms:
- Scripts are written to temp files (e.g., `%TEMP%/device-select-<timestamp>.ps1`)
- Executed with `powershell -ExecutionPolicy Bypass -File <path>`
- Cleaned up after execution
- Dialogs have `$form.Topmost = $true` to appear above other windows

## TypeScript Configuration

- Target: ESNext, Module: Preserve (for Bun bundler)
- Strict mode enabled with `noUncheckedIndexedAccess`
- Module resolution: `bundler`
- No emission (handled by Bun compile)

## Dependencies

Key dependencies (from `ts-version/package.json`):
- `@winput/keyboard` - Windows keyboard automation (global hotkeys, text injection)
- `node-cpal` - Cross-platform audio capture via N-API
- `systray2` - Windows system tray integration
- `form-data` - Multipart form data construction for HTTP requests

## Debugging

Enable console output for debugging:
```powershell
$env:DEBUG="true"; .\speech-to-text.exe
```

Logs are always written to `~/.speech-2-text/app.log` regardless of DEBUG setting.

See `AGENTS.md` for comprehensive code guidelines.
