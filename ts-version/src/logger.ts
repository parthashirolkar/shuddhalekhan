import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const LOG_DIR = join(homedir(), ".speech-2-text");
const LOG_FILE = join(LOG_DIR, "app.log");

type LogLevel = "INFO" | "ERROR" | "WARNING" | "RECORDING" | "TRANSCRIBING" | "RESULT";

export class Logger {
  private logFilePath: string;

  constructor(logFilePath?: string) {
    this.logFilePath = logFilePath || LOG_FILE;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private writeLog(level: LogLevel, message: string): void {
    const formattedMessage = this.formatMessage(level, message);
    try {
      appendFileSync(this.logFilePath, formattedMessage + "\n", "utf-8");
    } catch (error) {
      console.error(`Failed to write to log file: ${error}`);
    }
  }

  info(message: string): void {
    this.writeLog("INFO", message);
  }

  error(message: string): void {
    this.writeLog("ERROR", message);
  }

  warning(message: string): void {
    this.writeLog("WARNING", message);
  }

  recording(message: string): void {
    this.writeLog("RECORDING", message);
  }

  transcribing(message: string): void {
    this.writeLog("TRANSCRIBING", message);
  }

  result(message: string): void {
    this.writeLog("RESULT", message);
  }
}

export const logger = new Logger();
