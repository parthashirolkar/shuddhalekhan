"""Build Script

Creates Inno Setup installer and PyInstaller build.
"""

import os
import sys
import subprocess
import shutil

# Fix console encoding for Windows UTF-8 characters
if sys.platform == "win32":
    import codecs

    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "strict")
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer, "strict")


# Icon file path (constant at module level)
ICON_PATH = "assets/shuddhalekhan.ico"


def create_icon():
    """Create application icon"""
    # Check if icon already exists
    if os.path.exists(ICON_PATH):
        print(f"[INFO] Using existing icon at {ICON_PATH}")
        return

    from PIL import Image, ImageDraw

    # Create 256x256 icon
    img = Image.new("RGB", (256, 256), color="#2C3E50")
    draw = ImageDraw.Draw(img)

    # Simple microphone icon
    center_x, center_y = 128, 128

    # Mic head (circle)
    draw.ellipse(
        [center_x - 40, center_y - 40, center_x + 40, center_y + 40], fill="#4A90E2"
    )

    # Mic handle (rectangle)
    draw.rectangle(
        [center_x - 12, center_y + 20, center_x + 12, center_y + 60], fill="#4A90E2"
    )

    # Mic stand (lines)
    draw.line(
        [center_x - 32, center_y + 72, center_x - 20, center_y + 80],
        fill="#4A90E2",
        width=4,
    )
    draw.line(
        [center_x + 20, center_y + 72, center_x + 32, center_y + 80],
        fill="#4A90E2",
        width=4,
    )
    draw.line(
        [center_x - 20, center_y + 80, center_x + 20, center_y + 80],
        fill="#4A90E2",
        width=4,
    )

    # Save as ICO (using Pillow's ICO save)
    img.save(ICON_PATH, format="ICO")
    print(f"Icon created: {ICON_PATH}")


def build_installer():
    """Build Inno Setup installer"""
    print("=" * 60)
    print("  Building Inno Setup Installer")
    print("=" * 60)
    print()

    # Ensure icon exists
    if not os.path.exists(ICON_PATH):
        print("[INFO] Creating application icon...")
        create_icon()

    # Check for Inno Setup Compiler (iscc)
    inno_path = None

    # Possible executable names
    possible_names = ["iscc", "ISCC", "ISCC.exe"]

    # Common installation paths
    possible_paths = [
        # User-provided path
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files (x86)\Inno Setup 5\ISCC.exe",
        # Standard PATH locations
        shutil.which("iscc"),
        shutil.which("ISCC"),
        shutil.which("ISCC.exe"),
    ]

    for path in possible_paths:
        if path and os.path.exists(path):
            inno_path = path
            break

    if inno_path:
        print(f"[INFO] Using Inno Setup: {inno_path}")
    else:
        print()
        print("[ERROR] Inno Setup Compiler (ISCC) not found!")
        print("Checked locations:")
        for path in possible_paths:
            exists = "✓" if os.path.exists(path) else "✗"
            print(f"  {exists} {path}")
        print()
        print("To build installer, download Inno Setup from:")
        print("  https://jrsoftware.org/isdl.php")
        return 1

    print(f"[INFO] Building installer...")
    build_cmd = [
        inno_path,
        "installer/shuddhalekhan.iss",
    ]

    try:
        subprocess.run(build_cmd, check=True)
        print()
        print("=" * 60)
        print("  ✓ Build successful!")
        print("=" * 60)
        print()
        print(f"[INFO] Installer created at: Output/shuddhalekhan-setup.exe (~30-50MB)")
        print()
        print("[INFO] You can now distribute to installer.")
        print()
        print("What's included:")
        print("  - shuddhalekhan.exe (your app)")
        print("  - check_python_312.cmd (Python installer)")
        print("  - Install dependencies silently")
        print()
        return 0

    except subprocess.CalledProcessError as e:
        print()
        print("=" * 60)
        print(f"  ✗ Build failed: {e}")
        print("=" * 60)
        return 1


def build_pyinstaller():
    """Build PyInstaller executable (all-in-one)"""
    print("=" * 60)
    print("  Building PyInstaller EXE (All-in-One)")
    print("=" * 60)
    print()

    # Ensure icon exists
    if not os.path.exists(ICON_PATH):
        print("[INFO] Creating application icon...")
        create_icon()

    # PyInstaller command
    pyinstaller_cmd = [
        "pyinstaller",
        "--onefile",
        "--windowed",
        f"--icon={ICON_PATH}",
        "--name=Shuddhalekhan",
        "--add-data=app;app",
        "--hidden-import=PIL._tkinter_finder",
        "--clean",
        "app/main.py",
    ]

    print()
    print("[INFO] Running PyInstaller...")
    try:
        subprocess.run(pyinstaller_cmd, check=True)
        print()
        print("=" * 60)
        print("  ✓ Build successful!")
        print("=" * 60)
        print()
        print(f"[INFO] Executable created at: dist/Shuddhalekhan.exe")
        print()
        print("[INFO] WARNING: This EXE includes torch and transformers (~2.4GB)")
        print("[INFO]           Recommended only for testing or power users.")
        print()
        print("[INFO]           For distribution, use: python build.py installer")
        print()
        return 0

    except FileNotFoundError:
        print()
        print("[ERROR] PyInstaller not installed!")
        print()
        print("To build, install PyInstaller:")
        print("  uv add --dev pyinstaller")
        return 1
    except subprocess.CalledProcessError as e:
        print()
        print("=" * 60)
        print(f"  ✗ Build failed: {e}")
        print("=" * 60)
        return 1


def main():
    """Build application"""
    if len(sys.argv) > 1:
        mode = sys.argv[1]
    else:
        mode = "installer"  # Default

    if mode == "installer":
        build_installer()
    elif mode == "pyinstaller":
        build_pyinstaller()
    else:
        print("Usage: python build.py [installer|pyinstaller]")
        return 1


if __name__ == "__main__":
    sys.exit(main())


def build_installer():
    """Build Inno Setup installer"""
    print("=" * 60)
    print("  Building Inno Setup Installer")
    print("=" * 60)
    print()

    # Ensure icon exists
    if not os.path.exists("assets/shuddhalekhan.ico"):
        print("[INFO] Creating application icon...")
        create_icon()

    # Check for Inno Setup Compiler (ISCC)
    # Try multiple possible locations and names
    inno_path = None

    # Possible executable names
    possible_names = ["iscc", "ISCC", "ISCC.exe"]

    # Common installation paths
    possible_paths = [
        # User-provided path
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files (x86)\Inno Setup 6\iscc.exe",
        # Standard PATH locations
        shutil.which("iscc"),
        shutil.which("ISCC"),
        shutil.which("ISCC.exe"),
    ]

    for path in possible_paths:
        if path and os.path.exists(path):
            inno_path = path
            break

    if inno_path:
        print(f"[INFO] Using Inno Setup: {inno_path}")
    else:
        print()
        print("[ERROR] Inno Setup Compiler (ISCC) not found!")
        print()
        print("Checked locations:")
        for path in possible_paths:
            if path:
                exists = "✓" if os.path.exists(path) else "✗"
                print(f"  {exists} {path}")
            else:
                print(f"  (searching) {path}")
        print()
        print("To build installer, download Inno Setup from:")
        print("  https://jrsoftware.org/isdl.php")
        return 1

    print(f"[INFO] Found Inno Setup at: {inno_path}")
    print()

    # Build installer
    build_cmd = [
        inno_path,
        "installer/shuddhalekhan.iss",
    ]

    print()
    print("[INFO] Building installer...")
    try:
        subprocess.run(build_cmd, check=True)
        print()
        print("=" * 60)
        print("  ✓ Build successful!")
        print("=" * 60)
        print()
        print(f"[INFO] Installer created at: Output/shuddhalekhan-setup.exe (~30-50MB)")
        print()
        print("[INFO] You can now distribute the installer.")
        print()
        print("What's included:")
        print("  - Shuddhalekhan.exe (Python application)")
        print("  - check_python_312.cmd (Python installer)")
        print("  - Install dependencies silently")
        print()
        return 0

    except subprocess.CalledProcessError as e:
        print()
        print("=" * 60)
        print(f"  ✗ Build failed: {e}")
        print("=" * 60)
        return 1


def build_pyinstaller():
    """Build PyInstaller executable (all-in-one)"""
    print("=" * 60)
    print("  Building PyInstaller EXE (All-in-One)")
    print("=" * 60)
    print()

    # PyInstaller command
    pyinstaller_cmd = [
        "pyinstaller",
        "--onefile",
        "--windowed",
        "--icon=assets/shuddhalekhan.ico",
        "--name=Shuddhalekhan",
        "--add-data=app;app",
        "--hidden-import=PIL._tkinter_finder",
        "--clean",
        "app/main.py",
    ]

    # Ensure icon exists
    if not os.path.exists("assets/shuddhalekhan.ico"):
        print("[INFO] Creating application icon...")
        create_icon()

    print()
    print("[INFO] Running PyInstaller...")
    try:
        subprocess.run(pyinstaller_cmd, check=True)
        print()
        print("=" * 60)
        print("  ✓ Build successful!")
        print("=" * 60)
        print()
        print("[INFO] Executable created at: dist/Shuddhalekhan.exe")
        print()
        print("[INFO] WARNING: This EXE includes torch and transformers (~2-4GB)")
        print("[INFO]           Recommended only for testing or power users.")
        print("[INFO]           For distribution, use: python build.py installer")
        return 0

    except FileNotFoundError:
        print()
        print("[ERROR] PyInstaller not installed!")
        print()
        print("To build, install PyInstaller:")
        print("  uv add --dev pyinstaller")
        return 1
    except subprocess.CalledProcessError as e:
        print()
        print("=" * 60)
        print(f"  ✗ Build failed: {e}")
        print("=" * 60)
        return 1

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
