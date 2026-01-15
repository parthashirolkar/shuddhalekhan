# AGENTS.md

This file provides guidelines for agentic coding tools working in this repository.

---

## Project Overview

Python 3.12+ speech-to-text CLI application using OpenAI Whisper Large V3 Turbo model.
- **Package Manager**: UV
- **Main Script**: `main.py`
- **Model**: Hugging Face `openai/whisper-large-v3-turbo`

---

## Build, Lint, Test Commands

```bash
# Install dependencies
uv sync

# Run the application
uv run python main.py

# Format (if black added)
uv run black main.py

# Lint (if ruff added)
uv run ruff check main.py

# Type check (if mypy added)
uv run mypy main.py

# Run tests (if pytest added)
uv run pytest tests/test_specific.py

# Run single test function
uv run pytest tests/test_specific.py::test_function_name
```

---

## Code Style Guidelines

### Imports

- Group imports: stdlib, third-party, local (blank lines between)
- Order alphabetically within groups
- Avoid wildcard imports

```python
import sys
import time
import threading
import numpy as np
import torch
from transformers import AutoModelForSpeechSeq2Seq
```

### Formatting & Naming

- 4-space indentation, 100 char line limit
- Docstrings with triple double quotes
- Constants: `UPPER_SNAKE_CASE` (e.g., `SAMPLE_RATE`)
- Classes: `PascalCase` (e.g., `AudioRecorder`)
- Functions: `snake_case` (e.g., `transcribe()`)
- Private methods: `_prefix`
- Type hints using `| None` syntax (Python 3.10+)

```python
def transcribe(self, audio_array) -> str | None:
    if audio_array is None or len(audio_array) == 0:
        return None
    return result["text"]
```

### Error Handling

- Print errors to `sys.stderr`, not stdout
- Return `None` on error
- Use context managers and `__del__` for cleanup

```python
try:
    result = self.pipeline(audio_input)
except Exception as e:
    print(f"Transcription error: {e}", file=sys.stderr)
    return None
```

### Classes & Threading

- Use docstrings for class/method descriptions
- Static methods: `@staticmethod` decorator
- Private methods start with underscore
- Threads: `thread.daemon = True`, use `queue.Queue`, join with timeout

### Configuration

- UPPERCASE constants at module level with section comments

```python
# ─── CONFIGURATION ──────────────────────────────────────────────────────
SAMPLE_RATE = 16000  # Required by Whisper model
CHANNELS = 1  # Mono audio
```

### File Structure

- Section comments: `# ─── SECTION NAME ───`
- Organize into logical sections (Config, Classes, Main)
- `if __name__ == "__main__":` guard
- Flush stdout: `sys.stdout.flush()`

### Logging & Output

- Info to stdout, errors to `sys.stderr`
- Use `flush=True` and `\r` for progress
- Format: `[LEVEL] message`

```python
print("\r[TRANSCRIBING] Processing...", end="", flush=True)
print(f"[ERROR] Transcription failed\n", file=sys.stderr)
```

### Audio Processing

- Convert to float32, normalize to [-1, 1]
- Use `np.frombuffer()`, `np.concatenate()`
- Handle empty/short audio edge cases

---

## Dependencies

Managed via `pyproject.toml`: `keyboard`, `pyaudio`, `torch`, `transformers`
Add with: `uv add package-name`

---

## Testing

No tests yet. When adding: use `pytest`, `tests/` dir, `test_*.py` files, `test_*()` functions, mock external deps.

---

## Python Version

Minimum: 3.12. Use modern features (match, `|` union, walrus operator).
