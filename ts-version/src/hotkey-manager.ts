import { keyboard, type KeyName } from "@winput/keyboard";

type RecordingAction = "start" | "stop_with_newline" | "stop_without_newline";

type ActionHandler = (action: RecordingAction) => void;

export class HotkeyManager {
  private ctrlKeyCodes = new Set<number>();
  private winKeyCodes = new Set<number>();
  private altKeyCodes = new Set<number>();
  private isRecording = false;
  private actionHandler: ActionHandler | null = null;
  private listenerStarted = false;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    keyboard.listener.on.down((e) => {
      const keyName = e.key as string;

      if (keyName === "ctrl" || keyName === "ctrlleft" || keyName === "ctrlright") {
        this.ctrlKeyCodes.add(e.vk_code);
        this.checkStartRecording();
      } else if (keyName === "win" || keyName === "lwin" || keyName === "rwin") {
        this.winKeyCodes.add(e.vk_code);
        this.checkStartRecording();
      } else if (keyName === "alt" || keyName === "altleft" || keyName === "altright") {
        this.altKeyCodes.add(e.vk_code);
        this.checkStopWithoutNewline();
      }
    });

    keyboard.listener.on.up((e) => {
      const keyName = e.key as string;

      if (keyName === "ctrl" || keyName === "ctrlleft" || keyName === "ctrlright") {
        this.ctrlKeyCodes.delete(e.vk_code);
        this.checkStopWithNewline();
      } else if (keyName === "win" || keyName === "lwin" || keyName === "rwin") {
        this.winKeyCodes.delete(e.vk_code);
      } else if (keyName === "alt" || keyName === "altleft" || keyName === "altright") {
        this.altKeyCodes.delete(e.vk_code);
      }
    });
  }

  private checkStartRecording(): void {
    if (!this.isRecording && this.ctrlKeyCodes.size > 0 && this.winKeyCodes.size > 0) {
      this.triggerAction("start");
    }
  }

  private checkStopWithNewline(): void {
    if (this.isRecording && this.ctrlKeyCodes.size === 0 && this.altKeyCodes.size === 0) {
      this.triggerAction("stop_with_newline");
    }
  }

  private checkStopWithoutNewline(): void {
    if (this.isRecording) {
      this.triggerAction("stop_without_newline");
    }
  }

  private triggerAction(action: RecordingAction): void {
    if (this.actionHandler) {
      this.actionHandler(action);
    }
  }

  setRecordingState(recording: boolean): void {
    this.isRecording = recording;
  }

  onAction(handler: ActionHandler): void {
    this.actionHandler = handler;
  }

  start(): void {
    if (!this.listenerStarted) {
      keyboard.listener.start();
      this.listenerStarted = true;
    }
  }

  stop(): void {
    if (this.listenerStarted) {
      keyboard.listener.stop();
      this.listenerStarted = false;
    }
  }
}
