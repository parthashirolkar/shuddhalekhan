# Shuddhalekhan 3.0.2

This is a patch release that fixes the system tray icon in packaged builds and cleans up a diagnostic log bridge.

## What's Changed

- Fixed tray icon not appearing in packaged builds by bundling the `icons/` directory via `extraResources` in the Electron Builder config and adding a fallback path resolution.
- Removed the temporary `console-message` diagnostic logger that forwarded the audio window renderer console to the main process.

## Update Note

If you already have the Electron-based Shuddhalekhan installed, the auto-updater will download and install this patch automatically.
