import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { logger } from "./logger.ts";
import { AudioDeviceManager, type AudioDevice } from "./audio-device-manager.ts";
import { AudioRecorder } from "./audio-recorder.ts";
import { tmpdir } from "node:os";

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

interface Config {
  audio: {
    deviceId?: string;
    deviceName?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export class TrayManager {
  private systray: any = null;
  private recordingState: RecordingState = "idle";
  private configPath: string;
  private onExitCallback?: () => void;
  private statusItem: MenuItemClickable;
  private audioDeviceManager: AudioDeviceManager;
  private config: Config;
  private audioRecorder?: AudioRecorder;

  constructor(configPath: string, audioRecorder?: AudioRecorder) {
    this.configPath = configPath;
    this.audioDeviceManager = new AudioDeviceManager();
    this.config = this.loadConfig();
    this.audioRecorder = audioRecorder;

    this.statusItem = {
      title: "🎤 Ready to record",
      tooltip: "Ready to record",
      checked: false,
      enabled: false,
    };
  }

  private loadConfig(): Config {
    try {
      const configData = readFileSync(this.configPath, "utf-8");
      return JSON.parse(configData);
    } catch (error) {
      logger.error(`Failed to load config: ${error}`);
      return { audio: {} };
    }
  }

  private saveConfig(config: Config): void {
    try {
      // Write config atomically
      const configData = JSON.stringify(config, null, 2);
      writeFileSync(this.configPath, configData, "utf-8");
      this.config = config;
      logger.info("Config saved");
    } catch (error) {
      logger.error(`Failed to save config: ${error}`);
    }
  }

  async initialize(): Promise<void> {
    const menuItems: MenuItemClickable[] = [
      this.statusItem,
      { title: "-", tooltip: "", checked: false, enabled: false },
      {
        title: "Choose Input Device...",
        tooltip: "Select audio input device",
        checked: false,
        enabled: true,
        click: () => this.handleChooseDevice(),
      },
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
        tooltip: "About शुद्धलेखन (Shuddhlekhan)",
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
        title: "शुद्धलेखन (Shuddhlekhan)",
        tooltip: "शुद्धलेखन (Shuddhlekhan) - Ready",
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

  private async handleChooseDevice(): Promise<void> {
    try {
      const devices = this.audioDeviceManager.getInputDevices();

      if (devices.length === 0) {
        await this.showNotification("No Devices", "No audio input devices found");
        return;
      }

      const currentDeviceId = this.config.audio.deviceId;

      // Create PowerShell script
      const deviceItems = devices
        .map(
          (d) => `        $listBox.Items.Add('${d.name.replace(/'/g, "''")}${
            d.isDefault ? " (Default)" : ""
          }') | Out-Null`
        )
        .join("\n");

      const selectIndex =
        currentDeviceId && devices.findIndex((d) => d.id === currentDeviceId) >= 0
          ? `        $listBox.SelectedIndex = ${devices.findIndex(
              (d) => d.id === currentDeviceId
            )}`
          : "";

      const psScript = `Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Select Audio Input Device'
$form.Size = New-Object System.Drawing.Size(400, 300)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Topmost = $true

$label = New-Object System.Windows.Forms.Label
$label.Location = New-Object System.Drawing.Point(10, 10)
$label.Size = New-Object System.Drawing.Size(380, 20)
$label.Text = 'Choose an audio input device:'
$form.Controls.Add($label)

$listBox = New-Object System.Windows.Forms.ListBox
$listBox.Location = New-Object System.Drawing.Point(10, 40)
$listBox.Size = New-Object System.Drawing.Size(360, 150)
$listBox.SelectionMode = 'One'

${deviceItems}

${selectIndex}

$form.Controls.Add($listBox)

$okButton = New-Object System.Windows.Forms.Button
$okButton.Location = New-Object System.Drawing.Point(200, 210)
$okButton.Size = New-Object System.Drawing.Size(75, 23)
$okButton.Text = 'OK'
$okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($okButton)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Location = New-Object System.Drawing.Point(290, 210)
$cancelButton.Size = New-Object System.Drawing.Size(75, 23)
$cancelButton.Text = 'Cancel'
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancelButton)

$form.AcceptButton = $okButton
$form.CancelButton = $cancelButton

$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $listBox.SelectedIndex
} else {
  Write-Output -1
}
`;

      // Write script to temp file
      const tempScriptPath = join(tmpdir(), `device-select-${Date.now()}.ps1`);
      writeFileSync(tempScriptPath, psScript, "utf-8");

      try {
        const { stdout, stderr } = await execAsync(
          `powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`,
          { timeout: 30000 }
        );

        const selectedIndex = parseInt(stdout.trim(), 10);

        if (selectedIndex >= 0 && selectedIndex < devices.length) {
          const selectedDevice = devices[selectedIndex];
          if (selectedDevice) {
            await this.selectDevice(selectedDevice);
          }
        }
      } finally {
        // Clean up temp file
        try {
          unlinkSync(tempScriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      logger.error(`Failed to show device selection dialog: ${error}`);
    }
  }

  private async selectDevice(device: AudioDevice): Promise<void> {
    try {
      logger.info(`Selecting audio device: ${device.name}`);

      // Update config
      this.config.audio.deviceId = device.id;
      this.config.audio.deviceName = device.name;
      this.saveConfig(this.config);

      // Reinitialize audio recorder with new device
      if (this.audioRecorder) {
        await this.audioRecorder.reinitialize(device.id);
        logger.info(`Audio recorder reinitialized with device: ${device.name}`);
      }

      await this.showNotification(
        "Device Changed",
        `Now using: ${device.name}`
      );

      logger.result(`Audio device changed to: ${device.name}`);
    } catch (error) {
      logger.error(`Failed to change device: ${error}`);
      await this.showNotification(
        "Error",
        "Failed to change audio device. See logs."
      );
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
      "शुद्धलेखन (Shuddhlekhan)",
      "Windows शुद्धलेखन (Shuddhlekhan) with Whisper.cpp\n\nVersion: 1.0.0\n\nPress Ctrl+Win to start recording"
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
