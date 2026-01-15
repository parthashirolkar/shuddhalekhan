"""Audio Recorder Module

Handles microphone audio capture using PyAudio.
"""

import sys
import time
import threading
import queue
import numpy as np
import pyaudio


# ─── CONFIGURATION ───────────────────────────────────────────────────
SAMPLE_RATE = 16000  # Required by Whisper model
CHANNELS = 1  # Mono audio
CHUNK_SIZE = 1024  # Audio buffer size
FORMAT = pyaudio.paInt16  # 16-bit PCM


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
