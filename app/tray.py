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
        self._idle_icon = None
        self._recording_icon = None

    def _create_icon_with_color(self, bg_color: str, mic_color: str):
        """Create microphone icon with specified colors

        Args:
            bg_color: Background color hex code
            mic_color: Microphone color hex code

        Returns:
            PIL Image object
        """
        img = Image.new("RGB", (64, 64), color=bg_color)
        draw = ImageDraw.Draw(img)

        # Simple microphone icon
        # Mic head (circle)
        center_x, center_y = 32, 32
        draw.ellipse(
            [center_x - 10, center_y - 10, center_x + 10, center_y + 10],
            fill=mic_color,
        )

        # Mic handle (rectangle)
        draw.rectangle(
            [center_x - 3, center_y + 5, center_x + 3, center_y + 15],
            fill=mic_color,
        )

        # Mic stand (lines)
        draw.line(
            [center_x - 8, center_y + 18, center_x - 5, center_y + 20],
            fill=mic_color,
            width=2,
        )
        draw.line(
            [center_x + 5, center_y + 18, center_x + 8, center_y + 20],
            fill=mic_color,
            width=2,
        )
        draw.line(
            [center_x - 5, center_y + 20, center_x + 5, center_y + 20],
            fill=mic_color,
            width=2,
        )

        return img

    def create_icon(self):
        """Create system tray icon with pre-rendered icons"""
        # Pre-create both icons once
        self._idle_icon = self._create_icon_with_color("#2C3E50", "#4A90E2")
        self._recording_icon = self._create_icon_with_color("#E74C3C", "#FFFFFF")

        # Create icon
        self.icon = pystray.Icon(
            name="शुद्धलेखन (Shuddhalekhan)",
            icon=self._idle_icon,
            title="शुद्धलेखन - Loading model...",
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
        # Swap pre-created icons instead of redrawing
        self.icon.icon = self._recording_icon if is_recording else self._idle_icon

    def run(self):
        """Run the system tray icon (blocking)"""
        self.create_icon()
        self.icon.run()
