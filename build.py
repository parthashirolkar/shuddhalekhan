"""Build Script

Creates standalone Windows executable using PyInstaller.
"""

import os
import sys
import subprocess


def main():
    """Build application"""
    print("=" * 60)
    print("  Building शुद्धलेखन (Shuddhalekhan) Desktop Application")
    print("=" * 60)
    print()

    # PyInstaller command
    pyinstaller_cmd = [
        "pyinstaller",
        "--onefile",  # Create single EXE
        "--windowed",  # No console window
        "--icon=assets/icon.ico",  # App icon (if exists)
        "--name=Shuddhalekhan",  # EXE name
        "--add-data=app;app",  # Include app directory
        "--hidden-import=PIL._tkinter_finder",  # Fix PIL issues
        "--clean",  # Clean build files
        "app/main.py",  # Entry point
    ]

    # Create icon if doesn't exist
    icon_path = "assets/icon.ico"
    if not os.path.exists(icon_path):
        print(f"[INFO] Creating placeholder icon at {icon_path}...")
        try:
            from PIL import Image, ImageDraw

            img = Image.new("RGB", (256, 256), color="#2C3E50")
            draw = ImageDraw.Draw(img)
            # Simple mic icon
            draw.ellipse([96, 64, 160, 128], fill="#4A90E2")
            draw.rectangle([124, 112, 136, 144], fill="#4A90E2")
            # Save as ICO
            img.save(icon_path)
        except Exception as e:
            print(f"[WARNING] Could not create icon: {e}")
            pyinstaller_cmd.remove("--icon=assets/icon.ico")
    else:
        print(f"[INFO] Using existing icon at {icon_path}")

    print()
    print("[INFO] Running PyInstaller...")
    print()

    # Run PyInstaller
    try:
        subprocess.run(pyinstaller_cmd, check=True)
        print()
        print("=" * 60)
        print("  ✓ Build successful!")
        print("=" * 60)
        print()
        print("[INFO] Executable created at: dist/Shuddhalekhan.exe")
        print()
        print("[INFO] You can now distribute this EXE file.")
        print("[INFO] No Python installation required for end users.")
        print()
        return 0

    except subprocess.CalledProcessError as e:
        print()
        print("=" * 60)
        print(f"  ✗ Build failed: {e}")
        print("=" * 60)
        print()
        return 1
    except FileNotFoundError:
        print()
        print("[ERROR] PyInstaller not installed!")
        print()
        print("To build EXE, install PyInstaller:")
        print("  uv add --dev pyinstaller")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
