import { keyboard } from "@winput/keyboard";

export class TextInjector {
  async inject(text: string): Promise<void> {
    if (!text) {
      return;
    }

    try {
      const words = text.split(" ");
      for (let i = 0; i < words.length; i++) {
        if (words[i]) {
          keyboard.write(words[i]);
        }
        if (i < words.length - 1) {
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
    const textWithNewline = text.endsWith("\n") ? text : `${text}\n`;
    await this.inject(textWithNewline);
  }
}
