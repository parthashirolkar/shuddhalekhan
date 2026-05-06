import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { electronMock, installElectronMock, resetElectronMock } from '../../test/electron-mock';

const vi = { fn: mock, mock: mock.module, spyOn };

const screen = {
  getPrimaryDisplay: vi.fn(() => ({
    workAreaSize: { width: 1920, height: 1040 },
    workArea: { x: 0, y: 0 },
  })),
};

installElectronMock();

describe('positionPillWindow', () => {
  beforeEach(() => {
    resetElectronMock();
    electronMock.screen.getPrimaryDisplay.mockImplementation(screen.getPrimaryDisplay);
    screen.getPrimaryDisplay.mockReturnValue({
      workAreaSize: { width: 1920, height: 1040 },
      workArea: { x: 0, y: 0 },
    });
  });

  it('centers the recording pill near the bottom of the primary display', async () => {
    const { positionPillWindow } = await import(`../recording-pill?test=${Date.now()}-1`);
    const setPosition = vi.fn();

    positionPillWindow({ setPosition });

    expect(setPosition).toHaveBeenCalledWith(901, 938);
  });

  it('accounts for displays whose work area is offset', async () => {
    screen.getPrimaryDisplay.mockReturnValue({
      workAreaSize: { width: 1280, height: 720 },
      workArea: { x: 1920, y: 40 },
    });
    const { positionPillWindow } = await import(`../recording-pill?test=${Date.now()}-2`);
    const setPosition = vi.fn();

    positionPillWindow({ setPosition });

    expect(setPosition).toHaveBeenCalledWith(2501, 658);
  });
});
