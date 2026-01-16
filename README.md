# शुद्धलेखन (Shuddhalekhan) Desktop Application

Push-to-talk speech-to-text using OpenAI's Whisper Large V3 Turbo model with multi-language support and global hotkey control.

## Features

- 🎤 **Push-to-talk**: Press global hotkey to start recording, press again to transcribe
- 🌍 **Multi-language**: Supports 99 languages with auto-detection
- ⚡ **No file I/O**: Direct in-memory audio processing
- 🚀 **High accuracy**: Whisper Large V3 Turbo optimized for quality and speed
- 🖥️ **Windows optimized**: System tray app runs in background
- ⌨️ **Global hotkeys**: Record from anywhere without switching windows
- 📋 **Auto-inject**: Transcribed text is automatically inserted into active text field
- 🔧 **Configurable**: Customize hotkeys, model, and injection method
- 🎨 **Visual feedback**: System tray icon shows recording state

## Requirements

- Python 3.12+
- Windows OS (primary), macOS/Linux (experimental)
- Dependencies managed via `uv`:
  ```bash
  uv sync
  ```

## Installation

1. **Install dependencies**:
    ```bash
    uv sync
    ```

## How to Build

### Option 1: Development Run (Requires Python 3.12+)
```bash
# Install dependencies first
uv sync

# Run GUI application
uv run python -m app.main
```

### Option 2: Create Installer (Recommended for Distribution)

#### A. Inno Setup Installer (Professional, ~50MB download)

```bash
# Build installer (requires Inno Setup Compiler - ISCC)
python build.py installer

# This creates: Output/shuddhalekhan-setup.exe (~30-50MB)
# Includes:
#   - shuddhalekhan.exe (your app)
#   - check_python_312.cmd (installs Python 3.12 if needed)
#   - Icon and desktop shortcut
```
```

#### B. PyInstaller All-in-One (For power users, ~2.4GB)

```bash
# Build single EXE with everything bundled
python build.py pyinstaller

# This creates: dist/Shuddhalekhan.exe (~2.4GB)
# WARNING: Includes torch and transformers - huge download!
# Recommended only for testing or users who want zero-setup
```

---

## Usage

### Option 1: Development Run (Requires Python 3.12+)
```bash
# Install dependencies first
uv sync

# Run GUI application
uv run python -m app.main

# Or use script entry
uv run shuddhalekhan
```

### Option 2: Create Installer (Recommended for Distribution)

#### A. Inno Setup Installer (Professional, ~50MB download)

```bash
# Build installer (requires Inno Setup Compiler - ISCC)
python build.py installer

# This creates: Output/shuddhalekhan-setup.exe (~30-50MB)
# Includes:
#   - shuddhalekhan.exe (your app)
#   - check_python_312.cmd (installs Python 3.12 if needed)
#   - Icon and desktop shortcut
```

#### B. PyInstaller All-in-One (For power users, ~2.4GB)

```bash
# Build single EXE with everything bundled
python build.py pyinstaller

# This creates: dist/Shuddhalekhan.exe (~2.4GB)
# WARNING: Includes torch and transformers - huge download!
# Recommended only for testing or users who want zero-setup
```
~/.shuddhalekhan/config.yaml
```
~/.shuddhalekhan/config.yaml
```

You can customize:
- Model selection (tiny, base, small, medium, large-v3-turbo)
- Language (auto, en, es, fr, de, it, pt, nl, ru, zh, ja, ko, and more)
- Hotkey combinations
- Text injection method (clipboard or direct keyboard)
- Audio settings

## How It Works

1. **System Tray**: App runs as system tray icon in background
2. **Global Hotkeys**: Listen for hotkey combinations globally
3. **Recording**: Uses `pyaudio` to capture microphone input
4. **Processing**: Audio is normalized and converted to 16kHz mono format
5. **Transcription**: OpenAI Whisper Large V3 Turbo model transcribes audio
6. **Text Injection**: Transcribed text is copied to clipboard and pasted (Ctrl+V / Cmd+V) into active window

## Technical Details

- **Sample Rate**: 16000 Hz (required by Whisper model)
- **Audio Format**: Float32, normalized to [-1, 1]
- **Model**: `openai/whisper-large-v3-turbo` from Hugging Face
- **Language**: Default auto-detection, supports 99 languages
- **Precision**: bfloat16 (bf16) if supported, otherwise float16 or float32
- **Text Injection**: Clipboard paste (Ctrl+V on Windows, Cmd+V on macOS)

## CLI Mode (Original)

The original CLI version is still available:

1. **Run** CLI:
    ```bash
    uv run python main.py
    ```

2. **Use push-to-talk**:
    - Press **ENTER** to start recording
    - Press **ENTER** again to stop and transcribe
    - Press **Ctrl+C** to quit

## How It Works

1. **Recording**: Uses `pyaudio` to capture microphone input directly into memory
2. **Processing**: Audio is normalized and converted to 16kHz mono format
3. **Transcription**: OpenAI Whisper Large V3 Turbo model transcribes the audio
4. **Output**: Text is displayed in terminal with punctuation and capitalization

## Technical Details

- **Sample Rate**: 16000 Hz (required by Whisper model)
- **Audio Format**: Float32, normalized to [-1, 1]
- **Model**: `openai/whisper-large-v3-turbo` from Hugging Face
- **Language**: Default English, supports auto-detection and 99 languages

## Configuration

Modify constants in `main.py`:

```python
TARGET_LANGUAGE = "en"  # Change to "auto" for auto-detection
MODEL_ID = "openai/whisper-large-v3-turbo"
```

Supported languages include: `en`, `es`, `fr`, `de`, `it`, `pt`, `nl`, `ru`, `zh`, `ja`, `ko`, and 88 more.

## Troubleshooting

### "No audio captured"
- Check your microphone permissions in Windows settings
- Verify your default input device is selected
- Ensure microphone is not muted

### "Transcription failed"
- Ensure you spoke for at least 0.3 seconds
- Check that audio quality is sufficient (low noise)
- Verify stable internet connection for model download

### Model download issues
- Ensure stable internet connection on first run
- Model cached locally after first download (~2.5GB)
- Check available disk space

### PyAudio installation issues
- If `uv add pyaudio` fails, install PortAudio headers first:
  ```bash
  # Windows: Usually works out of the box with pre-built wheels
  # If issues persist, try: pip install pipwin && pipwin install pyaudio
  ```

## Notes

- The model runs on GPU if CUDA is available, otherwise falls back to CPU
- First run requires downloading the model (~2.5GB)
- Uses default Windows audio input device (no device selection needed)
