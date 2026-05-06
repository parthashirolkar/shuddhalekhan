import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { electronMock, installElectronMock, resetElectronMock } from '../../test/electron-mock';

const vi = { fn: mock, mock: mock.module, spyOn };

const on = vi.fn();
const destroy = vi.fn();
const isDestroyed = vi.fn(() => false);
const loadURL = vi.fn();
const loadFile = vi.fn();
const BrowserWindow = vi.fn(() => ({
  loadURL,
  loadFile,
  on,
  destroy,
  isDestroyed,
}));

installElectronMock();

describe('audio window', () => {
  beforeEach(() => {
    delete process.env.VITE_DEV_SERVER_URL;
    resetElectronMock();
    electronMock.BrowserWindow.mockImplementation(BrowserWindow);
    BrowserWindow.mockClear();
    loadURL.mockClear();
    loadFile.mockClear();
    on.mockClear();
    destroy.mockClear();
    isDestroyed.mockReturnValue(false);
  });

  it('creates one hidden audio window and reuses it while alive', async () => {
    const { createAudioWindow } = await import(`../audio-window?test=${Date.now()}-1`);

    const first = createAudioWindow();
    const second = createAudioWindow();

    expect(first).toBe(second);
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
    expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      width: 1,
      height: 1,
      show: false,
      focusable: false,
      webPreferences: expect.objectContaining({
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
      }) as Electron.BrowserWindowConstructorOptions['webPreferences'],
    }));
    expect(loadURL).toHaveBeenCalledWith('http://localhost:5173/#/audio');
  });

  it('loads the dev server URL when provided', async () => {
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:2468/';
    const { createAudioWindow } = await import(`../audio-window?test=${Date.now()}-2`);

    createAudioWindow();

    expect(loadURL).toHaveBeenCalledWith('http://localhost:2468/#/audio');
  });

  it('destroys the window and clears the singleton', async () => {
    const { createAudioWindow, destroyAudioWindow, getAudioWindow } = await import(
      `../audio-window?test=${Date.now()}-3`
    );

    createAudioWindow();
    destroyAudioWindow();

    expect(destroy).toHaveBeenCalled();
    expect(getAudioWindow()).toBeNull();
  });
});
