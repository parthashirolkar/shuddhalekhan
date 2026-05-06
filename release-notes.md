# Shuddhalekhan 3.0.1

This release is a major rewrite of Shuddhalekhan from Tauri to Electron.

## What's Changed

- Rebuilt the Windows desktop shell on Electron, Electron Vite, and React.
- Replaced the Tauri release/update path with Electron Builder and Electron Updater.
- Preserved the Windows tray workflow for dictation, transcription cleanup, update checks, and app exit.
- Added Windows native integration through Koffi for global keyboard hooks and clipboard paste simulation.
- Migrates existing legacy config from `.speech-2-text/config.json` into the new Electron config store on first run.
- Added Bun test coverage for main-process orchestration, tray behavior, config migration, updater wiring, preload IPC, Whisper integration, recording pill positioning, and audio capture helpers.

## Install Note

Because the installed app runtime changed from Tauri to Electron, users with the previous Tauri build should uninstall the old app and install this Electron build manually from this GitHub release. Future updates can then be delivered through the Electron updater.
