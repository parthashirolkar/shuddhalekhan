#!/usr/bin/env python3
"""
CLI Speech-to-Text using OpenAI Whisper Large V3 Turbo
Press and hold SPACE to record, release to transcribe
"""

import sys
import io
import time
import threading
import queue
import numpy as np
import pyaudio  # For audio capture
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")


# ─── CONFIGURATION ──────────────────────────────────────────────────────────────
SAMPLE_RATE = 16000  # Required by Whisper model
CHANNELS = 1  # Mono audio
CHUNK_SIZE = 1024  # Audio buffer size
FORMAT = pyaudio.paInt16  # 16-bit PCM
TARGET_LANGUAGE = "mr"  # English (auto-detect, can specify any language)
MODEL_ID = "openai/whisper-large-v3-turbo"

# ─── AUDIO RECORDER CLASS ─────────────────────────────────────────────────────
class AudioRecorder:
    """Handles microphone recording with push-to-talk support"""

    def __init__(self):
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.stream = None
        self.recording_thread = None
        self.audio = pyaudio.PyAudio()

    def _record_audio(self):
        """Background thread for recording audio"""
        try:
            self.stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=SAMPLE_RATE,
                input=True,
                frames_per_buffer=CHUNK_SIZE,
                stream_callback=self._audio_callback,
            )
            self.stream.start_stream()

            while self.is_recording:
                time.sleep(0.01)
        except Exception as e:
            print(f"Recording error: {e}", file=sys.stderr)
        finally:
            if self.stream:
                self.stream.stop_stream()
                self.stream.close()

    def _audio_callback(self, indata, frame_count, time_info, status):
        """Callback for audio stream"""
        if self.is_recording:
            audio_data = (
                np.frombuffer(indata, dtype=np.int16).astype(np.float32) / 32768.0
            )
            self.audio_queue.put(audio_data)
        return (None, pyaudio.paContinue)

    def start_recording(self):
        """Start recording audio"""
        if self.is_recording:
            return
        self.is_recording = True
        self.audio_queue = queue.Queue()

        # Start recording thread
        self.recording_thread = threading.Thread(target=self._record_audio)
        self.recording_thread.daemon = True
        self.recording_thread.start()

    def stop_recording(self):
        """Stop recording and return audio data"""
        if not self.is_recording:
            return None
        self.is_recording = False

        if self.recording_thread:
            self.recording_thread.join(timeout=1.0)

        audio_data = []
        while not self.audio_queue.empty():
            audio_data.append(self.audio_queue.get())

        if not audio_data:
            return None

        return np.concatenate(audio_data)

    def __del__(self):
        """Clean up PyAudio instance"""
        if hasattr(self, "audio"):
            self.audio.terminate()


# ─── MODEL CLASS ───────────────────────────────────────────────────────────────
class SpeechToTextModel:
    """Handles Whisper model loading and transcription"""

    def __init__(self, language="en"):
        self.language = language
        self.pipeline = None
        self._load_model()

    def _load_model(self):
        """Load Whisper model from Hugging Face"""
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32

        print(f"Loading OpenAI Whisper Large V3 Turbo (language: {self.language})...")
        print(f"Device: {device}")
        print("This may take a moment on first run...")
        sys.stdout.flush()

        # Load model and processor
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            MODEL_ID,
            torch_dtype=dtype,
            low_cpu_mem_usage=True,
            use_safetensors=True,
        )
        model.to(device)

        processor = AutoProcessor.from_pretrained(MODEL_ID)

        # Create pipeline
        self.pipeline = pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            torch_dtype=dtype,
            device=device,
        )

        print("[INFO] Model loaded successfully!\n")
        sys.stdout.flush()

    def transcribe(self, audio_array):
        """Transcribe audio array to text"""
        if audio_array is None or len(audio_array) == 0:
            return None

        # Prepare audio dictionary for pipeline
        audio_input = {"array": audio_array, "sampling_rate": SAMPLE_RATE}

        try:
            # Transcribe using Whisper pipeline
            if self.language == "auto":
                # Auto-detect language
                result = self.pipeline(audio_input)
            else:
                # Specify language
                result = self.pipeline(
                    audio_input, generate_kwargs={"language": self.language}
                )

            return result["text"]
        except Exception as e:
            print(f"Transcription error: {e}", file=sys.stderr)

        return None


# ─── MAIN CLI ──────────────────────────────────────────────────────────────────
def main():
    """Main CLI application"""
    print("=" * 60)
    print("  Speech-to-Text CLI - OpenAI Whisper Large V3 Turbo")
    print(f"  Language: {TARGET_LANGUAGE.upper()}")
    print(f"  Model: {MODEL_ID}")
    print("=" * 60)
    print()

    recorder = AudioRecorder()
    model = SpeechToTextModel(language=TARGET_LANGUAGE)

    print("READY TO TRANSCRIBE")
    print("-" * 60)
    print("Instructions:")
    print("  • Press ENTER to START recording")
    print("  • Press ENTER again to STOP and transcribe")
    print("  • Press Ctrl+C to quit")
    print("-" * 60)
    print()

    try:
        while True:
            print("\r[READY] Press ENTER to start recording...", end="", flush=True)
            input()

            print("\r[RECORDING] Press ENTER to stop...", end="", flush=True)
            recorder.start_recording()

            input()

            print("\r[TRANSCRIBING] Processing...", end="", flush=True)
            audio = recorder.stop_recording()

            if audio is not None and len(audio) > 0:
                duration = len(audio) / SAMPLE_RATE
                if duration < 0.3:
                    print("\r[WARNING] Recording too short (min 0.3s)", flush=True)
                    time.sleep(1)
                    continue

                text = model.transcribe(audio)

                print("\r" + " " * 60, end="", flush=True)
                if text:
                    print(f"\n{text}\n")
                else:
                    print("\n[ERROR] Transcription failed\n")
            else:
                print("\r[ERROR] No audio captured", flush=True)
                time.sleep(1)

    except KeyboardInterrupt:
        print("\n\n[INFO] Exiting...")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
