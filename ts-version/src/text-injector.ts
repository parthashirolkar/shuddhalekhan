import { keyboard } from "@winput/keyboard";

export class TextInjector {
  async inject(text: string): Promise<void> {
    if (!text) {
      return;
    }

    try {
      const lines = text.replace(/\n/g, "").split(" ");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          keyboard.write(lines[i]);
        }
        if (i < lines.length - 1) {
          keyboard.tap("space");
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[ERROR] Failed to inject text: ${error.message}`);
      } else {
        console.error("[ERROR] Failed to inject text: Unknown error");
      }
    }
  }

  async injectWithNewline(text: string): Promise<void> {
    if (!text) {
      return;
    }

    try {
      const cleanText = text.replace(/\n/g, "");
      const words = cleanText.split(" ");
      for (let i = 0; i < words.length; i++) {
        if (words[i]) {
          keyboard.write(words[i]);
        }
        if (i < words.length - 1) {
          keyboard.tap("space");
        }
      }
      keyboard.tap("enter");
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[ERROR] Failed to inject text: ${error.message}`);
      } else {
        console.error("[ERROR] Failed to inject text: Unknown error");
      }
    }
  }
}
