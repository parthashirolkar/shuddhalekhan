# AGENTS.md

This file provides guidelines for agentic coding tools working in this repository.

---

## Project Overview

TypeScript/Bun speech-to-text CLI application using whisper.cpp Docker container for GPU-accelerated transcription.
- **Runtime**: Bun v1.3.5+
- **Entry Point**: `ts-version/src/index.ts`
- **Model**: whisper.cpp with `ggml-large-v3-turbo.bin`
- **Native Modules**: @winput/keyboard, node-cpal (N-API bindings)

---

## Build, Lint, Test Commands

```bash
# Install dependencies
bun install

# Run the application
bun run src/index.ts

# Build standalone executable
bun build src/index.ts --compile --outfile speech-to-text.exe

# Type check (if tsc added)
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

- Prefix messages with `[LEVEL]`: `[INFO]`, `[WARNING]`, `[ERROR]`, `[RECORDING]`, etc.
- Info messages to `console.log`
- Errors to `console.error`
- Status updates use `console.log` for clarity

```typescript
console.log("[INFO] Running. Press Ctrl+C to quit.");
console.log("[RECORDING] Started...");
console.error(`[ERROR] Failed to transcribe: ${error.message}`);
```

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
- `form-data` - Multipart form data (optional)

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
bun build src/index.ts --compile --outfile app.exe
```

Bundler automatically:
- Includes Bun runtime (~90MB base)
- Bundles all dependencies
- Includes native .node modules
- Creates standalone Windows executable (~111MB total)

---

## Runtime Notes

- Bun implements 95% of Node-API, so most native modules work
- Use `node:` prefix for built-in modules
- No need for `package.json` "exports" field in simple apps
- Config at `~/.speech-2-text/config.json` created automatically
