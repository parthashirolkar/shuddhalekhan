export type AudioDevice = {
  deviceId: string;
  label: string;
  kind: 'audioinput';
};

export interface RendererToMainSendChannels {
  'audio-window-ready': () => void;
  'audio-data-ready': (audioData: ArrayBuffer) => void;
  'audio-devices': (devices: AudioDevice[]) => void;
  'audio-level-changed': (level: number) => void;
  'audio-duration-changed': (seconds: number) => void;
}

export interface RendererToMainInvokeChannels {
  'audio:start-recording': () => void;
  'audio:stop-recording': () => Promise<string>;
  'audio:get-devices': () => Promise<AudioDevice[]>;
  'audio:select-device': (deviceId: string) => void;
  'config:get': () => Promise<AppConfig>;
  'config:set': (key: keyof AppConfig, value: unknown) => void;
  'clipboard:inject-text': (text: string) => void;
  'updater:check': () => void;

}

export interface MainToRendererChannels {
  'audio:start-recording': () => void;
  'audio:stop-recording': () => void;
  'audio:select-device': (deviceId: string) => void;
  'recording:started': () => void;
  'recording:stopped': () => void;
  'audio:level-changed': (level: number) => void;
  'audio:duration-changed': (seconds: number) => void;
  'update:available': (info: { version: string }) => void;
}

export interface AppConfig {
  whisperUrl: string;
  selectedDeviceId: string | null;
  removeFillerWords: boolean;
}
