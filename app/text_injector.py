"""Text Injector Module

Handles text injection into active windows using clipboard or keyboard simulation.
"""

import sys
import time
import pyperclip
from pynput.keyboard import Key, Controller


class TextInjector:
    """Injects transcribed text into active windows"""

    def __init__(self, method: str = "clipboard"):
        """
        Args:
            method: 'clipboard' (default) or 'keyboard'
        """
        self.method = method
        self.keyboard = Controller()

    def inject(self, text: str) -> bool:
        """
        Inject text using configured method

        Args:
            text: Text to inject

        Returns:
            bool: Success status
        """
        if not text:
            return False

        if self.method == "clipboard":
            return self._inject_via_clipboard(text)
        else:
            return self._inject_via_keyboard(text)

    def _inject_via_clipboard(self, text: str) -> bool:
        """
        Copy text to clipboard and paste (Ctrl+V / Cmd+V)
        This is more reliable across applications.
        """
        try:
            # Save current clipboard content (optional - for restoring)
            # old_clipboard = pyperclip.paste()

            # Copy new text to clipboard
            pyperclip.copy(text)
            time.sleep(0.05)  # Small delay to ensure clipboard is ready

            # Paste based on platform
            if sys.platform == "darwin":
                # macOS: Cmd+V
                self.keyboard.press(Key.cmd)
                self.keyboard.press("v")
                self.keyboard.release("v")
                self.keyboard.release(Key.cmd)
            else:
                # Windows/Linux: Ctrl+V
                self.keyboard.press(Key.ctrl)
                self.keyboard.press("v")
                self.keyboard.release("v")
                self.keyboard.release(Key.ctrl)

            time.sleep(0.1)

            # Optionally restore clipboard:
            # time.sleep(0.1)
            # pyperclip.copy(old_clipboard)

            return True

        except Exception as e:
            print(f"[ERROR] Clipboard injection failed: {e}", file=sys.stderr)
            return False

    def _inject_via_keyboard(self, text: str) -> bool:
        """
        Type text directly using keyboard simulation
        Slower but doesn't affect clipboard.
        """
        try:
            # Type text with small delay between characters
            self.keyboard.type(text, delay=0.01)
            return True

        except Exception as e:
            print(f"[ERROR] Keyboard injection failed: {e}", file=sys.stderr)
            return False

    def inject_with_newline(self, text: str) -> bool:
        """
        Inject text and press Enter

        Args:
            text: Text to inject

        Returns:
            bool: Success status
        """
        success = self.inject(text)
        if not success:
            return False

        # Small delay after text
        time.sleep(0.1)

        # Press Enter
        self.keyboard.press(Key.enter)
        self.keyboard.release(Key.enter)

        return True
