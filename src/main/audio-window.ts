import { app, BrowserWindow } from 'electron';
import { join } from 'path';

let audioWindow: BrowserWindow | null = null;

export function getAudioWindow(): BrowserWindow | null {
  return audioWindow;
}

export function createAudioWindow(): BrowserWindow {
  if (audioWindow && !audioWindow.isDestroyed()) {
    return audioWindow;
  }

  audioWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    audioWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/audio`);
  } else if (!app.isPackaged) {
    audioWindow.loadURL('http://localhost:5173/#/audio');
  } else {
    audioWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'audio',
    });
  }

  audioWindow.on('closed', () => {
    audioWindow = null;
  });

  return audioWindow;
}

export function destroyAudioWindow(): void {
  if (audioWindow && !audioWindow.isDestroyed()) {
    audioWindow.destroy();
    audioWindow = null;
  }
}
