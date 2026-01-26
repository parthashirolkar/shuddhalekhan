import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { logger } from "./logger.ts";

// @ts-ignore - CommonJS module
const { default: SysTray } = require("systray2");

const execAsync = promisify(exec);

type RecordingState = "idle" | "recording" | "transcribing";

interface MenuItemClickable {
  title: string;
  tooltip: string;
  checked: boolean;
  enabled: boolean;
  click?: () => void;
}

export class TrayManager {
  private systray: any = null;
  private recordingState: RecordingState = "idle";
  private configPath: string;
  private onExitCallback?: () => void;
  private statusItem: MenuItemClickable;

  constructor(configPath: string) {
    this.configPath = configPath;
    this.statusItem = {
      title: "🎤 Ready to record",
      tooltip: "Ready to record",
      checked: false,
      enabled: false,
    };
  }

  async initialize(): Promise<void> {
    const menuItems: MenuItemClickable[] = [
      this.statusItem,
      { title: "-", tooltip: "", checked: false, enabled: false },
      {
        title: "Edit Config File",
        tooltip: "Open configuration file in default editor",
        checked: false,
        enabled: true,
        click: () => this.handleEditConfig(),
      },
      {
        title: "Open Config Folder",
        tooltip: "Open configuration folder",
        checked: false,
        enabled: true,
        click: () => this.handleOpenConfigFolder(),
      },
      { title: "-", tooltip: "", checked: false, enabled: false },
      {
        title: "View Logs",
        tooltip: "Open application log file",
        checked: false,
        enabled: true,
        click: () => this.handleViewLogs(),
      },
      { title: "-", tooltip: "", checked: false, enabled: false },
      {
        title: "About",
        tooltip: "About Speech-to-Text",
        checked: false,
        enabled: true,
        click: () => this.handleAbout(),
      },
      {
        title: "Exit",
        tooltip: "Exit application",
        checked: false,
        enabled: true,
        click: () => this.handleExit(),
      },
    ];

    this.systray = new SysTray({
      menu: {
        icon: this.getIcon(),
        title: "Speech-to-Text",
        tooltip: "Speech-to-Text - Ready",
        items: menuItems,
      },
      debug: false,
      copyDir: true,  // CRITICAL for icon to work in compiled executable
    });

    this.systray.onClick((action: any) => {
      if (action.item && action.item.click) {
        action.item.click();
      }
    });

    try {
      await this.systray.ready();
      logger.info("System tray initialized");
    } catch (error) {
      logger.error(`Failed to initialize system tray: ${error}`);
      throw error;
    }
  }

  private getIcon(): string {
    // Use relative path - systray2 will resolve it from working directory
    return "./tray-icon.ico";
  }

  private getStatusText(): string {
    switch (this.recordingState) {
      case "recording":
        return "🔴 Recording...";
      case "transcribing":
        return "⏳ Transcribing...";
      default:
        return "🎤 Ready to record";
    }
  }

  private async handleEditConfig(): Promise<void> {
    try {
      const platform = process.platform;
      let command: string;

      if (platform === "win32") {
        command = `start "" "${this.configPath}"`;
      } else if (platform === "darwin") {
        command = `open "${this.configPath}"`;
      } else {
        command = `xdg-open "${this.configPath}"`;
      }

      await execAsync(command);
      logger.info("Opened config file in editor");
    } catch (error) {
      logger.error(`Failed to open config file: ${error}`);
    }
  }

  private async handleOpenConfigFolder(): Promise<void> {
    try {
      const configDir = join(this.configPath, "..");
      const platform = process.platform;
      let command: string;

      if (platform === "win32") {
        command = `explorer "${configDir}"`;
      } else if (platform === "darwin") {
        command = `open "${configDir}"`;
      } else {
        command = `xdg-open "${configDir}"`;
      }

      await execAsync(command);
      logger.info("Opened config folder");
    } catch (error) {
      logger.error(`Failed to open config folder: ${error}`);
    }
  }

  private async handleViewLogs(): Promise<void> {
    try {
      const logPath = join(homedir(), ".speech-2-text", "app.log");
      const platform = process.platform;
      let command: string;

      if (platform === "win32") {
        command = `start "" "${logPath}"`;
      } else if (platform === "darwin") {
        command = `open "${logPath}"`;
      } else {
        command = `xdg-open "${logPath}"`;
      }

      await execAsync(command);
      logger.info("Opened log file");
    } catch (error) {
      logger.error(`Failed to open log file: ${error}`);
    }
  }

  private async handleAbout(): Promise<void> {
    await this.showNotification(
      "Speech-to-Text",
      "Windows Speech-to-Text with Whisper.cpp\n\nVersion: 1.0.0\n\nPress Ctrl+Win to start recording"
    );
  }

  private handleExit(): void {
    logger.info("Exiting application via tray menu");
    if (this.onExitCallback) {
      this.onExitCallback();
    }
  }

  private async showNotification(
    title: string,
    message: string
  ): Promise<void> {
    logger.info(`Notification: ${title} - ${message}`);
    try {
      const platform = process.platform;
      if (platform === "win32") {
        await execAsync(
          `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title.replace(/'/g, "''")}')"`
        );
      }
    } catch (error) {
      logger.error(`Failed to show notification: ${error}`);
    }
  }

  updateMenu(): void {
    if (!this.systray) {
      return;
    }

    const statusText = this.getStatusText();
    this.statusItem.title = statusText;
    this.statusItem.tooltip = statusText;

    this.systray.sendAction({
      type: "update-item",
      item: this.statusItem,
    });
  }

  setRecordingState(state: RecordingState): void {
    this.recordingState = state;
    this.updateMenu();
  }

  onExit(callback: () => void): void {
    this.onExitCallback = callback;
  }

  async shutdown(): Promise<void> {
    if (this.systray) {
      this.systray.kill(false);
      logger.info("System tray shut down");
    }
  }
}
