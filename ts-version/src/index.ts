import { AudioRecorder } from "./audio-recorder.ts";
import { WhisperClient } from "./whisper-client.ts";
import { HotkeyManager } from "./hotkey-manager.ts";
import { ConfigManager } from "./config.ts";
import { TextInjector } from "./text-injector.ts";

const configManager = new ConfigManager();
const config = configManager.getConfig();

const audioRecorder = new AudioRecorder();
const whisperClient = new WhisperClient(config.whisper.serverUrl);
const hotkeyManager = new HotkeyManager();
const textInjector = new TextInjector();

console.log("=".repeat(60));
console.log("  Speech-to-Text - Whisper.cpp GPU Server");
console.log(`  Server: ${config.whisper.serverUrl}`);
console.log("=".repeat(60));
console.log();

console.log("READY TO TRANSCRIBE");
console.log("-".repeat(60));
console.log("Hotkeys:");
console.log("  • Ctrl + Win: Start recording");
console.log("  • Ctrl: Stop recording and add newline");
console.log("  • Alt: Stop recording without newline");
console.log("-".repeat(60));
console.log();

hotkeyManager.onAction(async (action) => {
  switch (action) {
    case "start":
      console.log("[RECORDING] Started...");
      await audioRecorder.startRecording();
      hotkeyManager.setRecordingState(true);
      break;

    case "stop_with_newline":
      console.log("[STOPPING] Processing...");
      hotkeyManager.setRecordingState(false);
      await handleStopRecording(true);
      break;

    case "stop_without_newline":
      console.log("[STOPPING] Processing...");
      hotkeyManager.setRecordingState(false);
      await handleStopRecording(false);
      break;
  }
});

async function handleStopRecording(withNewline: boolean): Promise<void> {
  const wavBuffer = await audioRecorder.stopRecording();

  if (!wavBuffer) {
    console.log("[WARNING] No audio captured");
    return;
  }

  const pcmDataSize = wavBuffer.length - 44;
  const duration = pcmDataSize / (16000 * 1 * 2);
  if (duration < config.audio.minDuration) {
    console.log(`[WARNING] Recording too short (${duration.toFixed(2)}s, min ${config.audio.minDuration}s)`);
    return;
  }

  console.log(`[TRANSCRIBING] Processing ${duration.toFixed(2)}s of audio...`);

  const text = await whisperClient.transcribe(wavBuffer, config.whisper.temperature);

  if (!text) {
    console.log("[ERROR] Transcription failed");
    return;
  }

  console.log(`[RESULT] ${text}`);

  if (withNewline) {
    await textInjector.injectWithNewline(text);
  } else {
    await textInjector.inject(text);
  }

  console.log("[READY] Waiting for next recording...");
}

hotkeyManager.start();

console.log("[INFO] Running. Press Ctrl+C to quit.\n");

process.on("SIGINT", () => {
  console.log("\n[INFO] Shutting down...");
  hotkeyManager.stop();
  process.exit(0);
});
