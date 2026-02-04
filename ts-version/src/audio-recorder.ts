import { Buffer } from "node:buffer";
import * as cpal from "node-cpal";
import { logger } from "./logger.ts";

const SAMPLE_RATE = 16000;
const CHANNELS = 1;

export interface AudioRecorderResult {
  success: boolean;
  deviceId: string | null;
  deviceName: string | null;
  usedFallback: boolean;
}

export class AudioRecorder {
  private isRecording = false;
  private audioBuffers: Float32Array[] = [];
  private inputStream: any = null;
  private sampleRate = 16000;
  private channels = 1;
  private streamCreated = false;
  private discardAudio = true;

  private firstCallbackTime: number | null = null;
  private streamStartTime: number | null = null;

  async initialize(deviceId?: string): Promise<AudioRecorderResult> {
    if (this.streamCreated) {
      return {
        success: true,
        deviceId: null,
        deviceName: null,
        usedFallback: false
      };
    }

    if (deviceId) {
      try {
        const result = await this.initializeWithDevice(deviceId);
        logger.info(`Initialized with selected device: ${result.deviceName}`);
        return {
          success: true,
          deviceId: result.deviceId,
          deviceName: result.deviceName,
          usedFallback: false
        };
      } catch (error) {
        logger.warning(`Failed to initialize with device '${deviceId}': ${error instanceof Error ? error.message : String(error)}`);
        logger.info("Falling back to default audio device...");
      }
    }

    const defaultDevice = cpal.getDefaultInputDevice();
    try {
      const result = await this.initializeWithDevice(defaultDevice.deviceId);
      logger.info(`Initialized with default device: ${result.deviceName}`);
      return {
        success: true,
        deviceId: result.deviceId,
        deviceName: result.deviceName,
        usedFallback: !!deviceId
      };
    } catch (error) {
      logger.error(`Failed to initialize with default device: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async initializeWithDevice(deviceId: string): Promise<{ deviceId: string; deviceName: string }> {
    const inputDevice = deviceId
      ? { deviceId, name: deviceId }
      : cpal.getDefaultInputDevice();

    const inputConfig = cpal.getDefaultInputConfig(inputDevice.deviceId);

      this.inputStream = (cpal as any).createStream(
        inputDevice.deviceId,
        true,
        {
          sampleRate: inputConfig.sampleRate,
          channels: inputConfig.channels,
          sampleFormat: "f32",
        },
        (data: Float32Array) => {
          if (this.discardAudio) {
            return;
          }
          if (this.isRecording) {
            if (!this.firstCallbackTime) {
              this.firstCallbackTime = performance.now();
              const callbackDelay = this.firstCallbackTime - (this.streamStartTime ?? 0);
              logger.info(`[PERF] First audio callback fired after ${callbackDelay.toFixed(0)}ms`);
            }
            this.audioBuffers.push(new Float32Array(data));
          }
        }
      );

    this.sampleRate = inputConfig.sampleRate;
    this.channels = inputConfig.channels;
    this.streamCreated = true;

    return {
      deviceId: inputDevice.deviceId,
      deviceName: inputDevice.name
    };
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    if (!this.streamCreated) {
      await this.initialize();
    }

    this.isRecording = true;
    this.audioBuffers = [];
    this.discardAudio = false;
    this.streamStartTime = performance.now();
    this.firstCallbackTime = null;
  }

  async stopRecording(): Promise<Buffer | null> {
    if (!this.isRecording) {
      return null;
    }

    this.isRecording = false;
    this.discardAudio = true;

    if (this.inputStream && !this.streamCreated) {
      cpal.closeStream(this.inputStream);
      this.inputStream = null;
    }

    if (this.audioBuffers.length === 0) {
      return null;
    }

    const totalSamples = this.audioBuffers.reduce((sum, buf) => sum + buf.length, 0);

    const float32Data = new Float32Array(totalSamples);
    let offset = 0;
    for (const buffer of this.audioBuffers) {
      float32Data.set(buffer, offset);
      offset += buffer.length;
    }

    let processedData: Float32Array = float32Data;

    if (this.channels === 2) {
      processedData = this.downmixToMono(float32Data) as Float32Array;
    }

    if (this.sampleRate !== 16000) {
      processedData = this.resample(processedData, this.sampleRate, 16000) as Float32Array;
    }

    const int16Data = this.float32ToInt16(processedData);

    return this.addWavHeader(int16Data, 16000, 1);
  }

  shutdown(): void {
    if (this.inputStream && this.streamCreated) {
      cpal.closeStream(this.inputStream);
      this.inputStream = null;
      this.streamCreated = false;
    }
  }

  async reinitialize(deviceId?: string): Promise<void> {
    // Shutdown existing stream
    this.shutdown();

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Reinitialize with new device
    await this.initialize(deviceId);
  }

  private downmixToMono(stereoData: Float32Array) {
    const monoData = Float32Array.from({ length: stereoData.length / 2 }, (_, i) => {
      const left = stereoData[i * 2] ?? 0;
      const right = stereoData[i * 2 + 1] ?? 0;
      return (left + right) / 2;
    });
    return monoData;
  }

  private resample(data: Float32Array, fromRate: number, toRate: number) {
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(data.length / ratio);
    const resampled = Float32Array.from({ length: outputLength }, (_, i) => {
      const index = i * ratio;
      const lower = Math.floor(index);
      const upper = Math.min(lower + 1, data.length - 1);
      const fraction = index - lower;
      const lowerValue = data[lower] ?? 0;
      const upperValue = data[upper] ?? 0;
      return lowerValue * (1 - fraction) + upperValue * fraction;
    });

    return resampled;
  }

  private float32ToInt16(float32Array: Float32Array): Buffer {
    const int16Array = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i] ?? 0));
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return Buffer.from(int16Array.buffer);
  }

  private addWavHeader(int16Data: Buffer, sampleRate: number, channels: number): Buffer {
    const dataSize = int16Data.length;
    const headerSize = 44;
    const fileSize = dataSize + headerSize - 8;

    const header = Buffer.alloc(headerSize);
    let offset = 0;

    header.write("RIFF", offset);
    offset += 4;
    header.writeUInt32LE(fileSize, offset);
    offset += 4;
    header.write("WAVE", offset);
    offset += 4;
    header.write("fmt ", offset);
    offset += 4;
    header.writeUInt32LE(16, offset);
    offset += 4;
    header.writeUInt16LE(1, offset);
    offset += 2;
    header.writeUInt16LE(channels, offset);
    offset += 2;
    header.writeUInt32LE(sampleRate, offset);
    offset += 4;
    header.writeUInt32LE(sampleRate * channels * 2, offset);
    offset += 4;
    header.writeUInt16LE(channels * 2, offset);
    offset += 2;
    header.writeUInt16LE(16, offset);
    offset += 2;
    header.write("data", offset);
    offset += 4;
    header.writeUInt32LE(dataSize, offset);

    return Buffer.concat([header, int16Data]);
  }
}
