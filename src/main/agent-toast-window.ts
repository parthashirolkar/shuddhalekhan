import { app, BrowserWindow, screen } from 'electron';
import { join } from 'path';
import type { AgentToastState } from '../types/ipc';

let toastWindow: BrowserWindow | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AgentToastState | null = null;

const TOAST_WIDTH = 420;
const TOAST_HEIGHT = 190;
const APPROVAL_TOAST_WIDTH = 460;
const APPROVAL_TOAST_HEIGHT = 310;
const TOAST_MARGIN = 24;

export function showAgentToast(state: AgentToastState): void {
  const win = createAgentToastWindow();
  positionToastWindow(win, state.kind === 'approval');

  if (win.webContents.isLoading()) {
    pendingState = state;
  } else {
    win.webContents.send('agent-toast:update', state);
  }
  win.showInactive();

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (state.kind !== 'approval') {
    hideTimer = setTimeout(() => {
      if (toastWindow && !toastWindow.isDestroyed()) {
        toastWindow.hide();
      }
    }, state.kind === 'status' ? 3500 : 8500);
  }
}

export function hideAgentToast(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.hide();
  }
}

function createAgentToastWindow(): BrowserWindow {
  if (toastWindow && !toastWindow.isDestroyed()) {
    return toastWindow;
  }

  toastWindow = new BrowserWindow({
    width: TOAST_WIDTH,
    height: APPROVAL_TOAST_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  toastWindow.setAlwaysOnTop(true, 'floating');
  toastWindow.webContents.on('did-finish-load', () => {
    if (pendingState && toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.webContents.send('agent-toast:update', pendingState);
      pendingState = null;
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    toastWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/agent-toast`);
  } else if (!app.isPackaged) {
    toastWindow.loadURL('http://localhost:5173/#/agent-toast');
  } else {
    toastWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'agent-toast',
    });
  }

  toastWindow.on('closed', () => {
    toastWindow = null;
    pendingState = null;
  });

  return toastWindow;
}

function positionToastWindow(win: BrowserWindow, isApproval = false): void {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const toastWidth = isApproval ? APPROVAL_TOAST_WIDTH : TOAST_WIDTH;
  const toastHeight = isApproval ? APPROVAL_TOAST_HEIGHT : TOAST_HEIGHT;
  win.setBounds({
    x: x + width - toastWidth - TOAST_MARGIN,
    y: y + height - toastHeight - TOAST_MARGIN,
    width: toastWidth,
    height: toastHeight,
  });
}
