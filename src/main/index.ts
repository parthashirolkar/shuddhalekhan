import { app, BrowserWindow, ipcMain, clipboard, dialog, session } from 'electron';
import { join } from 'path';
import { keyboardHook } from './native/keyboard';
import { simulatePaste } from './native/clipboard';
import { createAudioWindow, getAudioWindow, destroyAudioWindow } from './audio-window';
import { showRecordingPill, hideRecordingPill, getRecordingPillWindow } from './recording-pill';
import { createTray, updateAudioDevices } from './tray';
import { getConfig, setConfig } from './config';
import { transcribe } from './whisper';
import { setupUpdater, checkForUpdates } from './updater';
import type { AppConfig, AudioDevice } from '../types/ipc';

let mainWindow: BrowserWindow | null = null;
let isRecording = false;
let isAudioWindowReady = false;
let pendingStartRecording = false;

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173/');
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function startRecording(): void {
  if (isRecording) return;
  isRecording = true;

  const audioWin = createAudioWindow();
  if (isAudioWindowReady && !audioWin.webContents.isLoading()) {
    audioWin.webContents.send('audio:start-recording');
  } else {
    pendingStartRecording = true;
    console.log('Queued recording start until audio window is ready');
  }

  showRecordingPill();
}

async function stopRecording(): Promise<void> {
  if (!isRecording) return;
  isRecording = false;

  hideRecordingPill();

  const audioWin = getAudioWindow();
  if (audioWin && !audioWin.isDestroyed()) {
    audioWin.webContents.send('audio:stop-recording');
  }
}

async function handleTranscription(audioData: Uint8Array): Promise<void> {
  if (audioData.byteLength <= 44) {
    console.warn(`Skipping empty WAV payload: ${audioData.byteLength} bytes`);
    return;
  }

  try {
    const text = await transcribe(audioData);
    if (!text) return;

    // Clipboard sandwich
    const originalClipboard = clipboard.readText();

    clipboard.writeText(text);
    await delay(50);

    simulatePaste();
    await delay(100);

    // Restore original clipboard
    if (originalClipboard) {
      clipboard.writeText(originalClipboard);
    }
  } catch (err) {
    console.error('Transcription failed:', err);
    dialog.showErrorBox('Transcription Error', err instanceof Error ? err.message : String(err));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// IPC handlers
ipcMain.handle('audio:start-recording', () => {
  startRecording();
});

ipcMain.handle('audio:stop-recording', async () => {
  await stopRecording();
  return 'stopped';
});

ipcMain.handle('audio:get-devices', async () => {
  const audioWin = getAudioWindow();
  if (!audioWin) return [];
  // Devices will be enumerated by the renderer and sent back via a different IPC
  // For now, return empty and let the tray update happen from the renderer
  return [];
});

ipcMain.handle('audio:select-device', (_event, deviceId: string) => {
  setConfig('selectedDeviceId', deviceId);
  const audioWin = getAudioWindow();
  if (audioWin && !audioWin.isDestroyed()) {
    audioWin.webContents.send('audio:select-device', deviceId);
  }
});

ipcMain.handle('config:get', () => {
  return getConfig();
});

ipcMain.handle('config:set', (_event, key: keyof AppConfig, value: AppConfig[keyof AppConfig]) => {
  setConfig(key, value);
});

ipcMain.handle('clipboard:inject-text', (_event, text: string) => {
  const originalClipboard = clipboard.readText();
  clipboard.writeText(text);
  setTimeout(() => {
    simulatePaste();
    setTimeout(() => {
      if (originalClipboard) {
        clipboard.writeText(originalClipboard);
      }
    }, 100);
  }, 50);
});

ipcMain.handle('updater:check', () => {
  checkForUpdates();
});

// Renderer -> Main events
ipcMain.on('audio-window-ready', () => {
  isAudioWindowReady = true;
  console.log('Audio window ready');

  if (pendingStartRecording && isRecording) {
    pendingStartRecording = false;
    const audioWin = getAudioWindow();
    if (audioWin && !audioWin.isDestroyed()) {
      audioWin.webContents.send('audio:start-recording');
    }
  }
});

ipcMain.on('audio-data-ready', async (_event, audioData: ArrayBuffer) => {
  const data = new Uint8Array(audioData);
  console.log(`Audio data ready: ${data.byteLength} bytes`);
  await handleTranscription(data);
});

ipcMain.on('audio-devices', (_event, devices: AudioDevice[]) => {
  updateAudioDevices(devices);
});

ipcMain.on('audio-level-changed', (_event, level: number) => {
  const pill = getRecordingPillWindow();
  if (pill && !pill.isDestroyed()) {
    pill.webContents.send('audio:level-changed', level);
  }
});

ipcMain.on('audio-duration-changed', (_event, seconds: number) => {
  const pill = getRecordingPillWindow();
  if (pill && !pill.isDestroyed()) {
    pill.webContents.send('audio:duration-changed', seconds);
  }
});

// App lifecycle
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  createMainWindow();
  const audioWin = createAudioWindow();
  audioWin.webContents.on('console-message', (_event, level, message) => {
    console.log(`[audio-window:${level}] ${message}`);
  });
  audioWin.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Audio window failed to load: ${errorCode} ${errorDescription}`);
  });
  audioWin.webContents.on('render-process-gone', (_event, details) => {
    isAudioWindowReady = false;
    console.error('Audio window renderer exited:', details.reason);
  });

  keyboardHook.start(
    () => startRecording(),
    () => stopRecording()
  );

  createTray(
    (enabled) => {
      console.log('Clean transcription:', enabled);
    },
    () => checkForUpdates()
  );

  setupUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows
});

app.on('before-quit', () => {
  keyboardHook.stop();
  destroyAudioWindow();
});

app.on('quit', () => {
  keyboardHook.stop();
});
