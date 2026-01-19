import { Buffer } from "node:buffer";
import * as cpal from "node-cpal";

const SAMPLE_RATE = 16000;
const CHANNELS = 1;

export class AudioRecorder {
  private isRecording = false;
  private audioBuffers: Float32Array[] = [];
  private inputStream: any = null;
  private sampleRate = 16000;
  private channels = 1;

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    this.isRecording = true;
    this.audioBuffers = [];

    try {
      const inputDevice = cpal.getDefaultInputDevice();

      const inputConfig = cpal.getDefaultInputConfig(inputDevice.deviceId);

      this.inputStream = cpal.createStream(
        inputDevice.deviceId,
        true,
        {
          sampleRate: inputConfig.sampleRate,
          channels: inputConfig.channels,
          sampleFormat: "f32",
        },
        (data: Float32Array) => {
          if (this.isRecording) {
            this.audioBuffers.push(new Float32Array(data));
          }
        }
      );

      this.sampleRate = inputConfig.sampleRate;
      this.channels = inputConfig.channels;
    } catch (error) {
      console.error(`[ERROR] Failed to start recording: ${error}`);
      this.isRecording = false;
    }
  }

  async stopRecording(): Promise<Buffer | null> {
    if (!this.isRecording) {
      return null;
    }

    this.isRecording = false;

    if (this.inputStream) {
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

    let processedData = float32Data;

    if (this.channels === 2) {
      processedData = this.downmixToMono(float32Data);
    }

    if (this.sampleRate !== 16000) {
      processedData = this.resample(processedData, this.sampleRate, 16000);
    }

    const int16Data = this.float32ToInt16(processedData);

    return this.addWavHeader(int16Data, 16000, 1);
  }

  private downmixToMono(stereoData: Float32Array): Float32Array {
    const monoData = new Float32Array(stereoData.length / 2);
    for (let i = 0; i < monoData.length; i++) {
      monoData[i] = (stereoData[i * 2] + stereoData[i * 2 + 1]) / 2;
    }
    return monoData;
  }

  private resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(data.length / ratio);
    const resampled = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const index = i * ratio;
      const lower = Math.floor(index);
      const upper = Math.min(lower + 1, data.length - 1);
      const fraction = index - lower;
      resampled[i] = data[lower] * (1 - fraction) + data[upper] * fraction;
    }

    return resampled;
  }

  private float32ToInt16(float32Array: Float32Array): Buffer {
    const int16Array = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
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
