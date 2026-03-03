import { homedir } from "node:os";
import { join } from "node:path";
import { AgentService } from "./agent-service.ts";
import { AudioRecorder } from "./audio-recorder.ts";
import { ConfigManager } from "./config.ts";
import { HotkeyManager } from "./hotkey-manager.ts";
import { logger } from "./logger.ts";
import { TextInjector } from "./text-injector.ts";
import { TrayManager } from "./tray-manager.ts";
import { WhisperClient } from "./whisper-client.ts";

const configManager = new ConfigManager();
const config = configManager.getConfig();

console.log("[DEBUG] Agent config:", JSON.stringify(config.agent, null, 2));
console.log("[DEBUG] Agent mode enabled:", config.agent?.enabled ?? false);

const audioRecorder = new AudioRecorder();
const whisperClient = new WhisperClient(config.whisper.serverUrl);
const hotkeyManager = new HotkeyManager();
const textInjector = new TextInjector();

const agentService = new AgentService({
	ollamaUrl: config.agent.ollamaUrl,
	model: config.agent.model,
	showConfirmation: config.agent.showConfirmation,
	confirmationTimeoutSeconds: config.agent.confirmationTimeoutSeconds,
});

const trayManager = new TrayManager(
	join(homedir(), ".speech-2-text", "config.json"),
	audioRecorder,
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

	const savedDeviceId = config.audio.deviceId;
	const result = await audioRecorder.initialize(savedDeviceId);

	if (result.usedFallback && result.deviceId && result.deviceName) {
		logger.info(
			"Saved device was unavailable, updating config with working device...",
		);
		configManager.updateConfig({
			audio: {
				...config.audio,
				deviceId: result.deviceId,
				deviceName: result.deviceName,
			},
		});
		configManager.saveConfig();
		logger.info(`Config updated: ${result.deviceName}`);
	}

	await trayManager.initialize();

	hotkeyManager.onAction(async (action) => {
		console.log(`[DEBUG] Action received: ${action}`);
		switch (action) {
			case "start": {
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
			}

			case "start_agent": {
				console.log(`[DEBUG] Agent mode enabled: ${config.agent.enabled}`);
				if (!config.agent.enabled) {
					logger.warning("Agent mode is disabled in config");
					console.log(
						"[DEBUG] Agent mode is disabled. Enable it via tray menu or config file.",
					);
					break;
				}
				logger.agent("Started agent recording");
				trayManager.setRecordingState("recording");
				const agentStartTime = performance.now();
				try {
					await audioRecorder.startRecording();
					const agentElapsed = performance.now() - agentStartTime;
					logger.info(
						`[PERF] startRecording() (agent) took ${agentElapsed.toFixed(0)}ms`,
					);
					hotkeyManager.setRecordingState(true);
				} catch (error) {
					logger.error(`Failed to start agent recording: ${error}`);
					trayManager.setRecordingState("idle");
				}
				break;
			}

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

			case "stop_agent":
				logger.recording("Stopping agent recording");
				hotkeyManager.setRecordingState(false);
				trayManager.setRecordingState("transcribing");
				await handleAgentMode();
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
			`Recording too short (${duration.toFixed(2)}s, min ${config.audio.minDuration}s)`,
		);
		trayManager.setRecordingState("idle");
		return;
	}

	logger.transcribing(`Processing ${duration.toFixed(2)}s of audio...`);

	const transcribeStart = performance.now();
	const text = await whisperClient.transcribe(
		wavBuffer,
		config.whisper.temperature,
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

async function handleAgentMode(): Promise<void> {
	console.log("[DEBUG] handleAgentMode called");
	const stopStart = performance.now();
	const wavBuffer = await audioRecorder.stopRecording();
	const stopElapsed = performance.now() - stopStart;
	logger.info(
		`[PERF] stopRecording() (agent) took ${stopElapsed.toFixed(0)}ms`,
	);

	if (!wavBuffer) {
		logger.warning("No audio captured in agent mode");
		trayManager.setRecordingState("idle");
		return;
	}

	const pcmDataSize = wavBuffer.length - 44;
	const duration = pcmDataSize / (16000 * 1 * 2);
	if (duration < config.audio.minDuration) {
		logger.warning(
			`Recording too short (${duration.toFixed(2)}s, min ${config.audio.minDuration}s)`,
		);
		trayManager.setRecordingState("idle");
		return;
	}

	logger.transcribing(
		`Processing ${duration.toFixed(2)}s of audio (agent mode)...`,
	);

	const transcribeStart = performance.now();
	const text = await whisperClient.transcribe(
		wavBuffer,
		config.whisper.temperature,
	);
	const transcribeElapsed = performance.now() - transcribeStart;
	logger.info(`[PERF] Transcription took ${transcribeElapsed.toFixed(0)}ms`);

	if (!text) {
		logger.error("Transcription failed in agent mode");
		trayManager.setRecordingState("idle");
		return;
	}

	logger.agent(`User input: ${text}`);
	console.log(`[DEBUG] Transcription received: "${text}"`);

	try {
		console.log("[DEBUG] Checking Ollama connection...");
		const ollamaConnected = await agentService.checkConnection();
		console.log(`[DEBUG] Ollama connected: ${ollamaConnected}`);
		if (!ollamaConnected) {
			logger.error("Cannot connect to Ollama server");
			trayManager.setRecordingState("idle");
			return;
		}

		console.log("[DEBUG] Running agent...");
		const response = await agentService.run(text);
		console.log("[DEBUG] Agent response:", response);

		if (response) {
			logger.agent(`Agent response: ${response}`);
		} else {
			logger.agent("No response from agent");
		}
	} catch (error) {
		logger.error(`Agent mode error: ${error}`);
	}

	trayManager.setRecordingState("idle");
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
