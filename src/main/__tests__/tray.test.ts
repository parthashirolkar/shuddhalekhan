import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { normalize } from 'path';
import { electronMock, installElectronMock, resetElectronMock } from '../../test/electron-mock';

const vi = { fn: mock, mock: mock.module, spyOn };

const setContextMenu = vi.fn();
const setToolTip = vi.fn();
const setIgnoreDoubleClickEvents = vi.fn();
const trayOn = vi.fn();
const resize = vi.fn(() => ({ resized: true }));
const createFromPath = vi.fn(() => ({ isEmpty: () => false, resize }));
const createFromDataURL = vi.fn(() => ({ fallback: true, resize }));
const buildFromTemplate = vi.fn((template: unknown) => template);
const quit = vi.fn();
const existsSync = vi.fn(() => true);
const config = {
  whisperUrl: 'http://localhost:8080/inference',
  selectedDeviceId: null as string | null,
  removeFillerWords: true,
};
const setConfig = vi.fn((key: keyof typeof config, value: never) => {
  config[key] = value;
});
const send = vi.fn();
let audioWindow: { isDestroyed: () => boolean; webContents: { send: typeof send } } | null = null;

installElectronMock();
mock.module('fs', () => ({ existsSync }));
mock.module('../config', () => ({
  getConfig: () => config,
  setConfig,
}));
mock.module('../audio-window', () => ({
  getAudioWindow: () => audioWindow,
}));

describe('tray', () => {
  beforeEach(() => {
    resetElectronMock();
    electronMock.Tray.mockImplementation(() => ({
      setToolTip,
      setIgnoreDoubleClickEvents,
      setContextMenu,
      on: trayOn,
    }));
    electronMock.Menu.buildFromTemplate.mockImplementation(buildFromTemplate);
    electronMock.nativeImage.createFromPath.mockImplementation(createFromPath);
    electronMock.nativeImage.createFromDataURL.mockImplementation(createFromDataURL);
    electronMock.app.quit.mockImplementation(quit);
    setContextMenu.mockClear();
    setToolTip.mockClear();
    setIgnoreDoubleClickEvents.mockClear();
    trayOn.mockClear();
    resize.mockClear();
    createFromPath.mockClear();
    createFromDataURL.mockClear();
    buildFromTemplate.mockClear();
    quit.mockClear();
    setConfig.mockClear();
    send.mockClear();
    existsSync.mockReturnValue(true);
    config.selectedDeviceId = null;
    config.removeFillerWords = true;
    audioWindow = null;
  });

  it('creates a tray with tooltip, icon, and context menu', async () => {
    const { createTray } = await import(`../tray?test=${Date.now()}-1`);

    createTray(vi.fn(), vi.fn());

    expect(createFromPath).toHaveBeenCalledWith(normalize('/app/icons/tray-icon.ico'));
    expect(resize).toHaveBeenCalledWith({ width: 16, height: 16 });
    expect(setToolTip).toHaveBeenCalledWith('Shuddhalekhan');
    expect(setIgnoreDoubleClickEvents).toHaveBeenCalledWith(true);
    expect(setContextMenu).toHaveBeenCalled();
  });

  it('falls back to an embedded icon when the file icon is missing', async () => {
    existsSync.mockReturnValue(false);
    const { createTray } = await import(`../tray?test=${Date.now()}-2`);

    createTray(vi.fn(), vi.fn());

    expect(createFromDataURL).toHaveBeenCalledWith(expect.stringContaining('data:image/svg+xml'));
  });

  it('filters audio inputs and sends device selections to the audio window', async () => {
    audioWindow = { isDestroyed: () => false, webContents: { send } };
    const { createTray, updateAudioDevices } = await import(`../tray?test=${Date.now()}-3`);
    createTray(vi.fn(), vi.fn());

    updateAudioDevices([
      { deviceId: 'default', label: 'Default Mic', kind: 'audioinput' },
      { deviceId: 'speaker', label: 'Speaker', kind: 'audioinput' },
    ]);
    const latestMenu = buildFromTemplate.mock.calls.at(-1)?.[0];
    const deviceItems = latestMenu[0].submenu;

    expect(deviceItems).toHaveLength(2);
    expect(deviceItems[0].checked).toBe(true);
    deviceItems[1].click();

    expect(setConfig).toHaveBeenCalledWith('selectedDeviceId', 'speaker');
    expect(send).toHaveBeenCalledWith('audio:select-device', 'speaker');
  });

  it('handles clean transcription, update check, and exit menu actions', async () => {
    const cleanHandler = vi.fn();
    const updateHandler = vi.fn();
    const { createTray } = await import(`../tray?test=${Date.now()}-4`);

    createTray(cleanHandler, updateHandler);
    const menu = buildFromTemplate.mock.calls.at(-1)?.[0];

    menu[2].click({ checked: false });
    menu[4].click();
    menu[5].click();

    expect(setConfig).toHaveBeenCalledWith('removeFillerWords', false);
    expect(cleanHandler).toHaveBeenCalledWith(false);
    expect(updateHandler).toHaveBeenCalled();
    expect(quit).toHaveBeenCalled();
  });
});
