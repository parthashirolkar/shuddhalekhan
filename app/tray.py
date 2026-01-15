"""System Tray Module

Handles system tray icon and menu using pystray.
"""

from PIL import Image, ImageDraw
import pystray


class TrayApp:
    """System tray icon with menu for शुद्धलेखन (Shuddhalekhan) app"""

    def __init__(self, main_app):
        """
        Args:
            main_app: Reference to SpeechToTextApp instance
        """
        self.main_app = main_app
        self.icon = None
        self.is_recording = False

    def create_icon(self):
        """Create system tray icon with microphone icon"""
        img = Image.new("RGB", (64, 64), color="#2C3E50")
        draw = ImageDraw.Draw(img)

        # Simple microphone icon
        # Mic head (circle)
        center_x, center_y = 32, 32
        draw.ellipse(
            [center_x - 10, center_y - 10, center_x + 10, center_y + 10], fill="#4A90E2"
        )

        # Mic handle (rectangle)
        draw.rectangle(
            [center_x - 3, center_y + 5, center_x + 3, center_y + 15], fill="#4A90E2"
        )

        # Mic stand (lines)
        draw.line(
            [center_x - 8, center_y + 18, center_x - 5, center_y + 20],
            fill="#4A90E2",
            width=2,
        )
        draw.line(
            [center_x + 5, center_y + 18, center_x + 8, center_y + 20],
            fill="#4A90E2",
            width=2,
        )
        draw.line(
            [center_x - 5, center_y + 20, center_x + 5, center_y + 20],
            fill="#4A90E2",
            width=2,
        )

        # Create icon
        self.icon = pystray.Icon(
            name="शुद्धलेखन (Shuddhalekhan)",
            icon=img,
            menu=pystray.Menu(
                pystray.MenuItem("Record (Ctrl+Win)", self._on_record_click),
                pystray.MenuItem("Settings", self._on_settings_click),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Quit", self._on_quit_click),
            ),
        )

    def _on_record_click(self, icon, item):
        """Handle record menu item click"""
        if self.is_recording:
            self.main_app.stop_recording()
        else:
            self.main_app.start_recording()

    def _on_settings_click(self, icon, item):
        """Handle settings menu item click (placeholder)"""
        print("[INFO] Settings not implemented yet", flush=True)
        # TODO: Open settings window

    def _on_quit_click(self, icon, item):
        """Handle quit menu item click"""
        self.main_app.quit()

    def set_recording_state(self, is_recording: bool):
        """
        Update icon to reflect recording state

        Args:
            is_recording: Whether currently recording
        """
        self.is_recording = is_recording

        # Update icon color to red when recording
        if self.is_recording:
            # Red mic icon for recording state
            img = Image.new("RGB", (64, 64), color="#E74C3C")
            draw = ImageDraw.Draw(img)

            # Mic head (circle)
            center_x, center_y = 32, 32
            draw.ellipse(
                [center_x - 10, center_y - 10, center_x + 10, center_y + 10],
                fill="#FFFFFF",
            )

            # Mic handle (rectangle)
            draw.rectangle(
                [center_x - 3, center_y + 5, center_x + 3, center_y + 15],
                fill="#FFFFFF",
            )

            # Mic stand (lines)
            draw.line(
                [center_x - 8, center_y + 18, center_x - 5, center_y + 20],
                fill="#FFFFFF",
                width=2,
            )
            draw.line(
                [center_x + 5, center_y + 18, center_x + 8, center_y + 20],
                fill="#FFFFFF",
                width=2,
            )
            draw.line(
                [center_x - 5, center_y + 20, center_x + 5, center_y + 20],
                fill="#FFFFFF",
                width=2,
            )

            self.icon.icon = img
        else:
            # Reset to normal blue icon
            img = Image.new("RGB", (64, 64), color="#2C3E50")
            draw = ImageDraw.Draw(img)

            # Mic head (circle)
            center_x, center_y = 32, 32
            draw.ellipse(
                [center_x - 10, center_y - 10, center_x + 10, center_y + 10],
                fill="#4A90E2",
            )

            # Mic handle (rectangle)
            draw.rectangle(
                [center_x - 3, center_y + 5, center_x + 3, center_y + 15],
                fill="#4A90E2",
            )

            # Mic stand (lines)
            draw.line(
                [center_x - 8, center_y + 18, center_x - 5, center_y + 20],
                fill="#4A90E2",
                width=2,
            )
            draw.line(
                [center_x + 5, center_y + 18, center_x + 8, center_y + 20],
                fill="#4A90E2",
                width=2,
            )
            draw.line(
                [center_x - 5, center_y + 20, center_x + 5, center_y + 20],
                fill="#4A90E2",
                width=2,
            )

            self.icon.icon = img

    def run(self):
        """Run the system tray icon (blocking)"""
        self.create_icon()
        self.icon.run()
