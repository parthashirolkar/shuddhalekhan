"""Hotkey Manager Module

Handles global hotkey registration and callbacks.
"""

import sys
import keyboard


class HotkeyManager:
    """Manages global hotkeys for recording control"""

    def __init__(self, main_app):
        """
        Args:
            main_app: Reference to SpeechToTextApp instance
        """
        self.main_app = main_app
        self.hotkeys = {"start": "ctrl+win", "stop": "ctrl", "stop_and_send": "alt"}

    def setup_hotkeys(self):
        """Register all global hotkeys"""
        try:
            # Start recording: Ctrl+Win
            keyboard.add_hotkey(self.hotkeys["start"], self.main_app.start_recording)

            # Stop recording: Ctrl
            keyboard.add_hotkey(self.hotkeys["stop"], self.main_app.stop_and_transcribe)

            # Stop and send: Alt
            keyboard.add_hotkey(
                self.hotkeys["stop_and_send"], self.main_app.stop_and_send
            )

            print(f"[INFO] Hotkeys registered:")
            print(f"  - Start: {self.hotkeys['start'].upper()}")
            print(f"  - Stop: {self.hotkeys['stop'].upper()}")
            print(f"  - Stop+Send: {self.hotkeys['stop_and_send'].upper()}")
            sys.stdout.flush()

        except Exception as e:
            print(f"[ERROR] Failed to register hotkeys: {e}", file=sys.stderr)

    def update_hotkeys(self, new_hotkeys: dict):
        """
        Update hotkey mappings

        Args:
            new_hotkeys: Dictionary with keys: start, stop, stop_and_send
        """
        # TODO: Remove old hotkeys and register new ones
        # This requires keyboard.remove_hotkey() which may not be available
        self.hotkeys.update(new_hotkeys)
        print(f"[INFO] Hotkeys updated: {self.hotkeys}", flush=True)
