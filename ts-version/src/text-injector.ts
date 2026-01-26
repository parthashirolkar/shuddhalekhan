import { keyboard } from "@winput/keyboard";

export class TextInjector {
  async inject(text: string): Promise<void> {
    if (!text) {
      return;
    }

    try {
      // Remove ALL line break characters (\n, \r, \r\n)
      const cleanText = text.replace(/[\r\n]+/g, " ").trim();
      const words = cleanText.split(/\s+/).filter((s): s is string => Boolean(s));
      for (const [i, word] of words.entries()) {
        keyboard.write(word);
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
    if (!text) {
      return;
    }

    try {
      // Remove ALL line break characters
      const cleanText = text.replace(/[\r\n]+/g, " ").trim();
      const words = cleanText.split(/\s+/).filter((s): s is string => Boolean(s));
      for (const [i, word] of words.entries()) {
        keyboard.write(word);
        if (i < words.length - 1) {
          keyboard.tap("space");
        }
      }
      // Do NOT press enter - just place text
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[ERROR] Failed to inject text: ${error.message}`);
      } else {
        console.error("[ERROR] Failed to inject text: Unknown error");
      }
    }
  }
}
