# Speech-to-Text - Whisper.cpp GPU Server

Fast, accurate speech-to-text using Whisper Large V3 Turbo model with GPU acceleration via whisper.cpp Docker container.

## Features

- 🎤 **Push-to-talk**: Global hotkeys to start/stop recording
- ⚡ **GPU accelerated**: Uses whisper.cpp with CUDA (RTX 4060+ recommended)
- 🚀 **Direct injection**: Text typed at cursor position (no clipboard pollution)
- 🖥️ **Windows optimized**: Native Windows keyboard automation
- 📋 **No file I/O**: Pure in-memory audio processing
- 🎨 **Configurable**: JSON-based configuration
- 📦 **Standalone**: Single 111MB executable with no dependencies
- 🧠 **Quantized model**: Q5_0 (574 MB) for optimal speed/quality balance

## Requirements

- **Windows 10/11** (x64)
- **NVIDIA GPU** with CUDA support (RTX 4060 or recommended)
- **Docker Desktop** for whisper.cpp server
- **Bun** runtime v1.0+ (or use pre-built executable)

## Installation

### Option 1: Pre-built Executable (Recommended)

1. **Run whisper.cpp Docker server**:
   ```powershell
   docker start whisper-cuda-server
   ```

2. **Run the executable**:
   ```powershell
   .\speech-to-text.exe
   ```

### Option 2: Build from Source

1. **Install Bun**:
   ```powershell
   irm bun.sh/install.ps1 | iex
   ```

2. **Clone and install dependencies**:
   ```powershell
   git clone https://github.com/parthashirolkar/speech-2-text.git
   cd speech-2-text\ts-version
   bun install
   ```

3. **Run**:
   ```powershell
   bun run src/index.ts
   ```

## Docker Setup (One-time)

**Note**: This documentation uses `C:\whisper\models` for model storage. You can change this to any directory you prefer - just update the path consistently in all commands below.

### Start whisper.cpp Server

```powershell
# Create model directory first
New-Item -Path "C:\whisper\models" -ItemType Directory -Force

docker run -dit --name whisper-cuda-server --entrypoint /app/build/bin/whisper-server `
  -p 8080:8080 --gpus all `
  -v "C:\whisper\models:/app/models" `
  -e "LD_LIBRARY_PATH=/usr/local/cuda-13.0/lib64:/usr/local/cuda-13.0/compat/lib64" `
  -e "GGML_CUDA=1" `
  ghcr.io/ggml-org/whisper.cpp:main-cuda-f53dc74843e97f19f94a79241357f74ad5b691a6 `
  --port 8080 --host 0.0.0.0 -m /app/models/ggml-large-v3-turbo-q5_0.bin
```

**⚠️ CRITICAL**: The `LD_LIBRARY_PATH` environment variable is required for CUDA GPU detection. Without it, the container will fall back to CPU-only mode.

### Download Model

**Recommended: Q5_0 quantized model** (65% smaller, near-original quality)
```powershell
# Download Q5_0 model (574 MB)
curl -L -o "C:\whisper\models\ggml-large-v3-turbo-q5_0.bin" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
```

**Alternative: F16 model** (full size, original quality)
```powershell
# Download F16 model (1.5 GB)
curl -L -o "C:\whisper\models\ggml-large-v3-turbo.bin" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"
```

### Save Startup Script (Optional)

Save as `C:\whisper\models\start-server.ps1`:
```powershell
docker start whisper-cuda-server
```

### Switching Between Models

To switch between Q5_0 and F16 models:

1. **Stop and remove current container**:
   ```powershell
   docker stop whisper-cuda-server
   docker rm whisper-cuda-server
   ```

2. **Start with different model**:
   ```powershell
   # For Q5_0 (recommended, 574 MB)
   docker run -dit --name whisper-cuda-server --entrypoint /app/build/bin/whisper-server `
     -p 8080:8080 --gpus all `
     -v "C:\whisper\models:/app/models" `
     -e "LD_LIBRARY_PATH=/usr/local/cuda-13.0/lib64:/usr/local/cuda-13.0/compat/lib64" `
     -e "GGML_CUDA=1" `
     ghcr.io/ggml-org/whisper.cpp:main-cuda-f53dc74843e97f19f94a79241357f74ad5b691a6 `
     --port 8080 --host 0.0.0.0 -m /app/models/ggml-large-v3-turbo-q5_0.bin

   # For F16 (full quality, 1.5 GB)
   docker run -dit --name whisper-cuda-server --entrypoint /app/build/bin/whisper-server `
     -p 8080:8080 --gpus all `
     -v "C:\whisper\models:/app/models" `
     -e "LD_LIBRARY_PATH=/usr/local/cuda-13.0/lib64:/usr/local/cuda-13.0/compat/lib64" `
     -e "GGML_CUDA=1" `
     ghcr.io/ggml-org/whisper.cpp:main-cuda-f53dc74843e97f19f94a79241357f74ad5b691a6 `
     --port 8080 --host 0.0.0.0 -m /app/models/ggml-large-v3-turbo.bin
   ```

**Model Comparison**:
- **Q5_0** (574 MB): 65% smaller, ~15-20% faster, near-original quality (recommended)
- **F16** (1.5 GB): Full quality, larger GPU memory usage

## Building Executable

```powershell
bun build src/index.ts --compile --outfile speech-to-text.exe
```

## Usage

### Hotkeys

- **Ctrl + Win**: Start recording
- **Ctrl**: Stop recording and add newline
- **Alt**: Stop recording without newline
- **Ctrl+C**: Quit application

### Example Output

```
============================================================
  Speech-to-Text - Whisper.cpp GPU Server
  Server: http://localhost:8080/inference
============================================================

READY TO TRANSCRIBE
------------------------------------------------------------
Hotkeys:
  • Ctrl + Win: Start recording
  • Ctrl: Stop recording and add newline
  • Alt: Stop recording without newline
------------------------------------------------------------

[INFO] Running. Press Ctrl+C to quit.

[RECORDING] Started...
[STOPPING] Processing...
[TRANSCRIBING] Processing 3.5s of audio...
[RESULT] Hello, this is a test transcription.
[READY] Waiting for next recording...
```

## Configuration

Configuration file at `~/.speech-2-text/config.json`:

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

## How It Works

1. **Hotkey Listener**: Runs in background listening for global key combinations
2. **Audio Recording**: Captures microphone input at native rate, resamples to 16kHz mono
3. **WAV Encoding**: Creates in-memory WAV buffer with 44-byte header
4. **Transcription**: Sends audio to whisper.cpp server via HTTP POST
5. **Text Injection**: Uses Windows SendInput API to type text directly at cursor

## Technical Details

- **Sample Rate**: 16000 Hz (required by Whisper)
- **Audio Format**: Int16 PCM, WAV format
- **Model**: `ggml-large-v3-turbo-q5_0.bin` (574 MB, 65% smaller than F16)
- **API**: whisper.cpp HTTP inference endpoint
- **Text Injection**: Direct keyboard input via `@winput/keyboard`
- **Runtime**: Bun with Node-API native modules
- **Dependencies**:
  - `@winput/keyboard` - Windows keyboard automation
  - `node-cpal` - Cross-platform audio capture (N-API binding)

## Troubleshooting

### "Docker container not running"
```powershell
docker ps | findstr whisper
# If empty, start it:
docker start whisper-cuda-server
```

### GPU not detected in container
If you see `ggml_cuda_init: failed to initialize CUDA: no CUDA-capable device is detected`:

1. **Verify GPU is accessible by Docker**:
   ```powershell
   docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi
   ```
   This should show your GPU info. If it fails, reinstall NVIDIA Container Toolkit.

2. **Ensure `LD_LIBRARY_PATH` is set**:
   The Docker run command must include: `-e "LD_LIBRARY_PATH=/usr/local/cuda-13.0/lib64:/usr/local/cuda-13.0/compat/lib64"`

3. **Check container logs**:
   ```powershell
   docker logs whisper-cuda-server
   ```
   You should see: `ggml_cuda_init: found 1 CUDA devices:`

### "Transcription failed"
- Verify whisper.cpp server is accessible: `curl http://localhost:8080/inference`
- Check Docker logs: `docker logs whisper-cuda-server`
- Ensure model file exists at mounted path

### "Failed to inject text"
- Ensure target application has text cursor active
- Some apps may block keyboard input
- Check console for specific error messages

### "No audio captured"
- Verify microphone is not muted
- Check Windows sound settings for default input device
- Ensure app has microphone permissions

### Model not found
```powershell
# Check if model exists (Q5_0 recommended)
ls C:\whisper\models\ggml-large-v3-turbo-q5_0.bin

# Download Q5_0 model if missing (574 MB)
curl -L -o "C:\whisper\models\ggml-large-v3-turbo-q5_0.bin" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"

# Or download F16 model if you prefer full quality (1.5 GB)
curl -L -o "C:\whisper\models\ggml-large-v3-turbo.bin" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"
```

## Architecture

```
ts-version/
├── src/
│   ├── index.ts              # Main entry point
│   ├── audio-recorder.ts      # Audio capture with resampling
│   ├── whisper-client.ts      # HTTP client for whisper.cpp
│   ├── hotkey-manager.ts     # Global hotkey detection
│   ├── text-injector.ts       # Windows keyboard automation
│   └── config.ts            # JSON configuration manager
├── package.json
├── tsconfig.json
└── speech-to-text.exe         # Compiled executable (111MB)
```

## License

MIT
