import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_CONFIG_PATH = join(homedir(), ".speech-2-text", "config.json");

export interface Config {
  whisper: {
    serverUrl: string;
    temperature: number;
    language: string;
  };
  audio: {
    sampleRate: number;
    channels: number;
    minDuration: number;
    deviceId?: number;
    deviceName?: string;
  };
  hotkeys: {
    startRecording: string[];
    stopWithNewline: string[];
    stopWithoutNewline: string[];
  };
}

const DEFAULT_CONFIG: Config = {
  whisper: {
    serverUrl: "http://localhost:8080/inference",
    temperature: 0.2,
    language: "auto",
  },
  audio: {
    sampleRate: 16000,
    channels: 1,
    minDuration: 0.3,
  },
  hotkeys: {
    startRecording: ["ctrl", "lwin"],
    stopWithNewline: ["ctrl"],
    stopWithoutNewline: ["alt"],
  },
};

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(configPath?: string) {
    this.configPath = configPath || DEFAULT_CONFIG_PATH;
    this.config = DEFAULT_CONFIG;
    this.loadConfig();
  }

  loadConfig(): void {
    try {
      const configData = readFileSync(this.configPath, "utf-8");
      const loadedConfig = JSON.parse(configData) as Partial<Config>;
      this.config = this.mergeConfig(DEFAULT_CONFIG, loadedConfig);
    } catch (error) {
      this.config = DEFAULT_CONFIG;
    }
  }

  saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[ERROR] Failed to save config: ${error.message}`);
      } else {
        console.error("[ERROR] Failed to save config: Unknown error");
      }
    }
  }

  getConfig(): Config {
    return { ...this.config };
  }

  updateConfig(updates: Partial<Config>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  private mergeConfig(base: Config, updates: Partial<Config>): Config {
    return {
      whisper: { ...base.whisper, ...updates.whisper },
      audio: { ...base.audio, ...updates.audio },
      hotkeys: { ...base.hotkeys, ...updates.hotkeys },
    };
  }
}
