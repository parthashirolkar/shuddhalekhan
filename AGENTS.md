# AGENTS.md

This file provides guidelines for agentic coding tools working in this repository.

---

## Project Overview

TypeScript/Bun speech-to-text system tray application using whisper.cpp Docker container for GPU-accelerated transcription.
- **Runtime**: Bun v1.3.5+
- **Entry Point**: `ts-version/src/index.ts`
- **Model**: whisper.cpp with `ggml-large-v3-turbo.bin`
- **Native Modules**: @winput/keyboard, node-cpal (N-API bindings)
- **UI**: Windows system tray with systray2
- **Logging**: Centralized logger with file output to `~/.speech-2-text/app.log`

---

## Build, Lint, Test Commands

```bash
# Install dependencies
bun install

# Run the application (development mode)
bun run src/index.ts

# Build standalone executable with console
bun run build

# Build headless GUI executable (recommended)
bun run build:headless

# Run with debug console
$env:DEBUG="true"; .\speech-to-text.exe

# Type check
bunx tsc --noEmit

# Run tests (if test framework added)
bun test tests/*.test.ts

# Run single test function
bun test tests/*.test.ts --test-name-pattern "test_function_name"
```

---

## Code Style Guidelines

### Imports

- Use `node:` prefix for built-in Node.js modules
- Group imports: stdlib (node:), third-party, local (blank lines between)
- Order alphabetically within groups
- No wildcard imports
- Use type-only imports for types: `import type { KeyName } from "@winput/keyboard"`

```typescript
import { Buffer } from "node:buffer";
import { keyboard } from "@winput/keyboard";
import { AudioRecorder } from "./audio-recorder.ts";
```

### Formatting & Naming

- 2-space indentation
- No semicolons (Bun convention)
- 100 char line limit
- No JSDoc comments
- Constants: `UPPER_SNAKE_CASE` (e.g., `SAMPLE_RATE`)
- Classes: `PascalCase` (e.g., `AudioRecorder`)
- Functions/Methods: `camelCase` (e.g., `startRecording()`)
- Private fields: `private fieldName`
- Private methods: `private methodName()`
- Types/Interfaces: `PascalCase` (e.g., `TranscriptionResult`)
- Type aliases: `type TypeName = ...`
- Explicit return types for public methods

```typescript
const SAMPLE_RATE = 16000;

export class AudioRecorder {
  private isRecording = false;

  async startRecording(): Promise<void> {
    // Implementation
  }
}
```

### Types

- Use `type` for aliases: `type RecordingAction = "start" | "stop"`
- Use `interface` for object shapes: `interface Config { ... }`
- Use `| null` union for nullable returns: `Promise<string | null>`
- Use `Partial<T>` for optional config updates
- Type assertions with `as`: `(result as TranscriptionResult).text`
- Check `error instanceof Error` for type narrowing

```typescript
type RecordingAction = "start" | "stop_with_newline" | "stop_without_newline";

interface Config {
  whisper: { serverUrl: string; temperature: number };
  audio: { sampleRate: number; channels: number };
}

async transcribe(): Promise<string | null> {
  try {
    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    return null;
  }
}
```

### Error Handling

- Log errors to `console.error` with `[ERROR]` prefix
- Return `null` on error for methods that return values
- Early return on errors/falsy values
- No throwing exceptions in user-facing code

```typescript
try {
  const data = JSON.parse(configData);
  return data;
} catch (error) {
  console.error(`[ERROR] Failed to parse config: ${error instanceof Error ? error.message : String(error)}`);
  return null;
}

if (!wavBuffer) {
  console.log("[WARNING] No audio captured");
  return;
}
```

### Logging & Output

**IMPORTANT**: Use the centralized logger module, NOT console.log/console.error.

```typescript
import { logger } from "./logger.ts"

logger.info("Application started")
logger.error("Failed to connect to server")
logger.warning("Configuration file not found, using defaults")
logger.recording("Started recording")
logger.transcribing("Processing audio...")
logger.result("Transcription: Hello world")
```

The logger automatically:
- Writes all logs to `~/.speech-2-text/app.log`
- Rotates log files when they exceed 1MB
- Outputs to console in development or when `DEBUG="true"`
- Prefixes messages with `[LEVEL]` tags: `[INFO]`, `[ERROR]`, `[WARNING]`, `[RECORDING]`, `[TRANSCRIBING]`, `[RESULT]`, `[PERF]`

**Never use** `console.log()`, `console.error()`, or `console.warn()` directly in application code.

### Classes & Methods

- Constructor params optional or default values
- Private fields with `private` modifier
- Private methods start with `private` keyword
- No `public` modifier (public is default)
- Callbacks use arrow functions
- Event listeners register in constructor or setup method

```typescript
export class HotkeyManager {
  private isRecording = false;
  private actionHandler: ActionHandler | null = null;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    keyboard.listener.on.down((e) => {
      // Handler
    });
  }
}
```

### Configuration

- Module-level constants at top of file
- Default config object with interface type
- Config manager with merge logic
- Default config path: `~/.speech-2-text/config.json`

```typescript
const DEFAULT_CONFIG_PATH = join(homedir(), ".speech-2-text", "config.json");

const DEFAULT_CONFIG: Config = {
  whisper: { serverUrl: "http://localhost:8080/inference", temperature: 0.2 },
  audio: { sampleRate: 16000, channels: 1 },
};
```

### Audio Processing

- Use `Buffer` for binary data
- Float32Array for audio samples
- Resample from device rate to 16000Hz
- Downmix stereo to mono by averaging
- Convert Float32 to Int16 PCM
- Add standard 44-byte WAV header
- All processing in-memory, no file I/O

```typescript
private float32ToInt16(float32Array: Float32Array): Buffer {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return Buffer.from(int16Array.buffer);
}
```

### HTTP Requests

- Use `fetch()` for HTTP requests
- Manual multipart/form-data construction (whisper.cpp compatibility)
- Check `response.ok` before processing
- JSON parsing with type assertion
- Handle network errors gracefully

---

## Dependencies

Managed via `ts-version/package.json`:
- `@winput/keyboard` - Windows keyboard automation
- `node-cpal` - Cross-platform audio capture (N-API)
- `systray2` - Windows system tray integration
- `form-data` - Multipart form data construction

Add with: `bun add package-name`

---

## Native Modules

- **@winput/keyboard**: Pure TypeScript with Windows API calls via FFI
- **node-cpal**: Neon-based N-API binding (Rust backend)
- Both work with Bun's Node-API implementation
- Build includes .node binaries automatically

---

## TypeScript Configuration

- Target: ESNext
- Module: Preserve (for Bun bundler)
- Strict mode enabled
- Module resolution: bundler
- No emission (bundled by Bun)

---

## Testing

No tests yet. When adding: use `bun test`, `tests/` dir, `*.test.ts` files, mock external deps.

---

## Building Executables

```bash
# Standard build (with console window)
bun build src/index.ts --compile --outfile app.exe

# Headless build (GUI subsystem, no console)
bun run build:headless
```

The headless build:
1. Builds the executable with Bun
2. Searches for Visual Studio's `editbin.exe`
3. Changes executable subsystem to WINDOWS (GUI mode)
4. Silently continues if editbin is not found

Bundler automatically:
- Includes Bun runtime (~90MB base)
- Bundles all dependencies
- Includes native .node modules
- Creates standalone Windows executable (~111MB total)

**Important**: Copy `tray-icon.ico` to the same directory as the executable for system tray functionality.

---

## Runtime Notes

- Bun implements 95% of Node-API, so most native modules work
- Use `node:` prefix for built-in modules
- No need for `package.json` "exports" field in simple apps
- Config at `~/.speech-2-text/config.json` created automatically
- Logs written to `~/.speech-2-text/app.log` (rotated at 1MB)
- System tray icon must be in same directory as executable

## System Tray Integration

The application uses `systray2` for Windows system tray functionality:

```typescript
import { SysTray } from "systray2"

const systray = new SysTray({
  menu: {
    icon: "./tray-icon.ico",  // Relative path from working directory
    title: "App Name",
    tooltip: "App Description",
    items: menuItems,
  },
  debug: false,
  copyDir: true,  // CRITICAL: must be true for icon to work in compiled executable
})

// Register click handler
systray.onClick((action) => {
  if (action.item.click) {
    action.item.click()
  }
})

// Wait for initialization
await systray.ready()
```

**Key points**:
- Use relative path `"./tray-icon.ico"`, NOT Bun's `import ... with { type: "file" }`
- Set `copyDir: true` or icon won't work in compiled executable
- Icon file must be in working directory (where executable runs)
- Update menu items dynamically with `systray.sendAction({ type: "update-item", item })`
