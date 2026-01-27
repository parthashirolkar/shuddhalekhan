import { AudioRecorder } from "./audio-recorder.ts";
import { WhisperClient } from "./whisper-client.ts";
import { HotkeyManager } from "./hotkey-manager.ts";
import { ConfigManager } from "./config.ts";
import { TextInjector } from "./text-injector.ts";
import { TrayManager } from "./tray-manager.ts";
import { logger } from "./logger.ts";
import { join } from "node:path";
import { homedir } from "node:os";

const configManager = new ConfigManager();
const config = configManager.getConfig();

const audioRecorder = new AudioRecorder();
const whisperClient = new WhisperClient(config.whisper.serverUrl);
const hotkeyManager = new HotkeyManager();
const textInjector = new TextInjector();

const trayManager = new TrayManager(
  join(homedir(), ".speech-2-text", "config.json"),
  audioRecorder
);

async function main(): Promise<void> {
  logger.info("=".repeat(60));
  logger.info("शुद्धलेखन (Shuddhlekhan) - System Tray Application");
  logger.info(`Server: ${config.whisper.serverUrl}`);
  logger.info("=".repeat(60));

  trayManager.onExit(() => {
    logger.info("Shutting down...");
    shutdown();
  });

  // Initialize audio recorder with saved device or default
  const savedDeviceId = config.audio.deviceId;
  if (savedDeviceId) {
    await audioRecorder.initialize(savedDeviceId);
    logger.info(
      `Audio recorder initialized with device: ${config.audio.deviceName || savedDeviceId}`
    );
  } else {
    await audioRecorder.initialize();
    logger.info("Audio recorder initialized with default device");
  }

  await trayManager.initialize();

  hotkeyManager.onAction(async (action) => {
    switch (action) {
      case "start":
        logger.recording("Started recording");
        trayManager.setRecordingState("recording");
        const startTime = performance.now();
        try {
          await audioRecorder.startRecording();
          const elapsed = performance.now() - startTime;
          logger.info(`[PERF] startRecording() took ${elapsed.toFixed(0)}ms`);
          hotkeyManager.setRecordingState(true);
        } catch (error) {
          logger.error(`Failed to start recording: ${error}`);
          trayManager.setRecordingState("idle");
        }
        break;

      case "stop_with_newline":
        logger.recording("Stopping recording with newline");
        hotkeyManager.setRecordingState(false);
        trayManager.setRecordingState("transcribing");
        await handleStopRecording(true);
        break;

      case "stop_without_newline":
        logger.recording("Stopping recording without newline");
        hotkeyManager.setRecordingState(false);
        trayManager.setRecordingState("transcribing");
        await handleStopRecording(false);
        break;
    }
  });

  hotkeyManager.start();
  logger.info("Hotkey listener started");
  logger.info("Application running in background");

  // Only keep stdin alive if DEBUG mode is enabled
  if (process.env.DEBUG === "true") {
    logger.info("DEBUG mode enabled - console will remain visible");
    process.stdin.resume();
  }
}

async function handleStopRecording(withNewline: boolean): Promise<void> {
  const stopStart = performance.now();
  const wavBuffer = await audioRecorder.stopRecording();
  const stopElapsed = performance.now() - stopStart;
  logger.info(`[PERF] stopRecording() took ${stopElapsed.toFixed(0)}ms`);

  if (!wavBuffer) {
    logger.warning("No audio captured");
    trayManager.setRecordingState("idle");
    return;
  }

  const pcmDataSize = wavBuffer.length - 44;
  const duration = pcmDataSize / (16000 * 1 * 2);
  if (duration < config.audio.minDuration) {
    logger.warning(
      `Recording too short (${duration.toFixed(2)}s, min ${config.audio.minDuration}s)`
    );
    trayManager.setRecordingState("idle");
    return;
  }

  logger.transcribing(`Processing ${duration.toFixed(2)}s of audio...`);

  const transcribeStart = performance.now();
  const text = await whisperClient.transcribe(
    wavBuffer,
    config.whisper.temperature
  );
  const transcribeElapsed = performance.now() - transcribeStart;
  logger.info(`[PERF] Transcription took ${transcribeElapsed.toFixed(0)}ms`);

  trayManager.setRecordingState("idle");

  if (!text) {
    logger.error("Transcription failed");
    return;
  }

  logger.result(`Transcription: ${text}`);

  // Always use inject() method - never press enter
  await textInjector.inject(text);
}

function shutdown(): void {
  hotkeyManager.stop();
  audioRecorder.shutdown();
  trayManager
    .shutdown()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`Error during shutdown: ${error}`);
      process.exit(1);
    });
}

process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down...");
  shutdown();
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down...");
  shutdown();
});

main().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});
