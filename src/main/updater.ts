import { autoUpdater } from 'electron-updater';
import { dialog } from 'electron';

export function setupUpdater(): void {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `Shuddhalekhan v${info.version} is available.`,
        detail: 'The update will be downloaded and installed automatically.',
        buttons: ['OK'],
      })
      .catch(() => {
        // ignore
      });
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `Shuddhalekhan v${info.version} has been downloaded.`,
        detail: 'The application will restart to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      })
      .catch(() => {
        // ignore
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates();
}
