import { app, BrowserWindow, screen } from 'electron';
import { join } from 'path';

let pillWindow: BrowserWindow | null = null;
const PILL_WINDOW_WIDTH = 118;
const PILL_WINDOW_HEIGHT = 54;

export function getRecordingPillWindow(): BrowserWindow | null {
  return pillWindow;
}

export function createRecordingPillWindow(): BrowserWindow {
  if (pillWindow && !pillWindow.isDestroyed()) {
    return pillWindow;
  }

  pillWindow = new BrowserWindow({
    width: PILL_WINDOW_WIDTH,
    height: PILL_WINDOW_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    pillWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/recording`);
  } else if (!app.isPackaged) {
    pillWindow.loadURL('http://localhost:5173/#/recording');
  } else {
    pillWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'recording',
    });
  }

  pillWindow.on('closed', () => {
    pillWindow = null;
  });

  return pillWindow;
}

export function showRecordingPill(): void {
  const win = createRecordingPillWindow();
  positionPillWindow(win);
  win.show();
  win.setAlwaysOnTop(true, 'screen-saver');
}

export function hideRecordingPill(): void {
  if (pillWindow && !pillWindow.isDestroyed()) {
    pillWindow.hide();
  }
}

export function positionPillWindow(window: Pick<BrowserWindow, 'setPosition'>): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const { x, y } = primaryDisplay.workArea;

  const bottomMargin = 48;

  const posX = x + Math.max(0, (width - PILL_WINDOW_WIDTH) / 2);
  const posY = y + Math.max(0, height - PILL_WINDOW_HEIGHT - bottomMargin);

  window.setPosition(Math.round(posX), Math.round(posY));
}
