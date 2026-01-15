"""Main Application Module

Integrates all components for Speech-to-Text desktop application.
"""

import sys
import time
import io
from pathlib import Path
from threading import Thread

from .recorder import AudioRecorder
from .model import SpeechToTextModel
from .text_injector import TextInjector
from .tray import TrayApp
from .hotkey import HotkeyManager
from .config import Config, DEFAULT_CONFIG


# Configure stdout/stderr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")


class SpeechToTextApp:
    """Main application class integrating all components"""

    def __init__(self, config_path: Path | None = None):
        """
        Args:
            config_path: Optional path to configuration file
        """
        self.config = Config(config_path)
        self.is_recording = False

        # Initialize components
        self.recorder = AudioRecorder()
        self.model = SpeechToTextModel(
            language=self.config.get("model.language", "auto")
        )
        self.text_injector = TextInjector(
            method=self.config.get("injection.method", "clipboard")
        )
        self.tray_app = TrayApp(self)
        self.hotkey_manager = HotkeyManager(self)

        # Setup components
        self._setup_hotkeys()

    def _setup_hotkeys(self):
        """Register hotkeys from configuration"""
        hotkeys = self.config.get("hotkeys", {})
        self.hotkey_manager.hotkeys = hotkeys
        self.hotkey_manager.setup_hotkeys()

    def start_recording(self):
        """Start audio recording"""
        if self.is_recording:
            print("[WARNING] Already recording", flush=True)
            return

        self.is_recording = True
        self.recorder.start_recording()
        self.tray_app.set_recording_state(True)
        print("[START] Recording audio...", flush=True)

    def stop_recording(self):
        """Stop recording without transcription"""
        if not self.is_recording:
            print("[WARNING] Not recording", flush=True)
            return

        self.is_recording = False
        audio = self.recorder.stop_recording()
        self.tray_app.set_recording_state(False)
        return audio

    def stop_and_transcribe(self):
        """Stop recording and transcribe to text"""
        if not self.is_recording:
            print("[WARNING] Not recording", flush=True)
            return

        self.is_recording = False
        self.tray_app.set_recording_state(False)

        print("[STOP] Transcribing...", flush=True)
        audio = self.recorder.stop_recording()

        if audio is not None:
            # Check audio duration (minimum 0.3s)
            from .recorder import SAMPLE_RATE

            duration = len(audio) / SAMPLE_RATE

            if duration < 0.3:
                print("[WARNING] Recording too short (min 0.3s)", flush=True)
                return

            # Transcribe
            text = self.model.transcribe(audio)

            if text and text.strip():
                print(f"[OUTPUT] {text}", flush=True)

                # Inject into active window
                self.text_injector.inject(text)
                print("[INFO] Text injected into active window", flush=True)
            else:
                print(
                    "[ERROR] Transcription failed or empty", file=sys.stderr, flush=True
                )
        else:
            print("[ERROR] No audio captured", file=sys.stderr, flush=True)

    def stop_and_send(self):
        """Stop recording and transcribe (no newline)"""
        if not self.is_recording:
            print("[WARNING] Not recording", flush=True)
            return

        self.is_recording = False
        self.tray_app.set_recording_state(False)

        print("[STOP] Transcribing...", flush=True)
        audio = self.recorder.stop_recording()

        if audio is not None:
            # Check audio duration
            from .recorder import SAMPLE_RATE

            duration = len(audio) / SAMPLE_RATE

            if duration < 0.3:
                print("[WARNING] Recording too short (min 0.3s)", flush=True)
                return

            # Transcribe
            text = self.model.transcribe(audio)

            if text and text.strip():
                print(f"[OUTPUT] {text}", flush=True)

                # Inject text (no automatic Enter)
                self.text_injector.inject(text)
                print("[INFO] Text injected into active field", flush=True)
            else:
                print(
                    "[ERROR] Transcription failed or empty", file=sys.stderr, flush=True
                )
        else:
            print("[ERROR] No audio captured", file=sys.stderr, flush=True)

    def quit(self):
        """Quit application"""
        print("[INFO] Quitting Speech-to-Text...", flush=True)

        # Stop recording if in progress
        if self.is_recording:
            self.stop_recording()

        # Stop tray icon
        if self.tray_app.icon:
            self.tray_app.icon.stop()

        sys.exit(0)

    def run(self):
        """Run the application"""
        # Display startup message
        print("=" * 60)
        print("  शुद्धलेखन (Shuddhalekhan) Desktop Application")
        print(f"  Model: {self.config.get('model.id')}")
        print(f"  Language: {self.config.get('model.language').upper()}")
        print(f"  Hotkeys:")
        print(
            f"    Start: {self.hotkey_manager.hotkeys.get('start', 'ctrl+win').upper()}"
        )
        print(f"    Stop: {self.hotkey_manager.hotkeys.get('stop', 'ctrl').upper()}")
        print(
            f"    Stop+Send: {self.hotkey_manager.hotkeys.get('stop_and_send', 'alt').upper()}"
        )
        print("=" * 60)
        print()

        # Load model in background
        print("[INFO] Loading model in background...", flush=True)
        self.model.load_model_async()

        # Wait for model to load before running tray
        print("[INFO] Waiting for model to load (up to 60s)...", flush=True)
        if not self.model.wait_for_model(timeout=60):
            print("[ERROR] Model failed to load", file=sys.stderr, flush=True)
            print(
                "[INFO] Application will still run, but transcription will fail",
                flush=True,
            )
        else:
            print("[INFO] Model loaded successfully!", flush=True)

        print()
        print("[INFO] System tray icon created. Application is running.")
        print("[INFO] Use hotkeys or right-click tray icon to control.")
        print("[INFO] Press Ctrl+C in terminal to exit.")
        print()

        # Run tray icon (blocking call)
        try:
            self.tray_app.run()
        except KeyboardInterrupt:
            self.quit()
        except Exception as e:
            print(f"[ERROR] Fatal error: {e}", file=sys.stderr, flush=True)
            self.quit()


def main() -> None:
    """Entry point for GUI application"""
    # Allow config path from command line
    import argparse

    parser = argparse.ArgumentParser(description="Speech-to-Text Desktop Application")
    parser.add_argument(
        "--config", type=Path, help="Path to configuration file", default=None
    )

    args = parser.parse_args()

    # Create and run application
    app = SpeechToTextApp(config_path=args.config)
    app.run()


if __name__ == "__main__":
    main()
