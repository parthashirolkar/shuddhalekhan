import { TrayIcon, TrayIconEvent } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { exit } from '@tauri-apps/plugin-process';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

let trayIcon: TrayIcon | null = null;

export async function setupTray() {
  if (trayIcon) {
    return;
  }

  const menu = await Menu.new({
    items: [
      {
        id: 'settings',
        text: 'Settings',
        action: async (id: string) => {
          console.log('Settings clicked, id:', id);
          const appWindow = await WebviewWindow.getByLabel('main');
          if (appWindow) {
            await appWindow.show();
            await appWindow.setFocus();
          } else {
            console.error('Could not find main window');
          }
        },
      },
      {
        id: 'quit',
        text: 'Quit',
        action: (id: string) => {
          console.log('Quit clicked, id:', id);
          exit(0);
        },
      },
    ],
  });

  const options = {
    id: 'main-tray',
    icon: 'icons/tray-icon.ico',
    menu,
    tooltip: 'Speech-to-Text',
    action: async (e: TrayIconEvent) => {
        if (e.type === 'Click' && e.button === 'Left') {
            const appWindow = await WebviewWindow.getByLabel('main');
            if (appWindow) {
              await appWindow.show();
              await appWindow.setFocus();
            }
        }
    }
  };

  try {
    trayIcon = await TrayIcon.new(options);
  } catch (error) {
    console.error("Failed to initialize tray:", error);
  }
}

export async function updateTrayRecordingState(isRecording: boolean) {
  if (!trayIcon) return;
  await trayIcon.setTooltip(isRecording ? 'Speech-to-Text (Recording...)' : 'Speech-to-Text');
  // We can also swap the icon dynamically here if we load a separate red dot icon
}