# Shuddhalekhan 3.1.0

This release marks the first fully functioning Electron port of Shuddhalekhan, with clearer app status and update visibility across the main window and system tray.

## What's Changed

- Added app version and update status to the main window.
- Added update status to the system tray menu, including checking, downloading, ready-to-install, latest, and error states.
- Added typed updater IPC channels for fetching app info, reading current update status, and manually checking for updates.
- Improved updater handling for packaged builds, development builds, download progress, downloaded updates, and failed checks.
- Added regression tests for updater lifecycle behavior and updated tray/main IPC coverage.

## Update Note

If you already have the Electron-based Shuddhalekhan installed, the auto-updater will download and install this release automatically once it is published.
