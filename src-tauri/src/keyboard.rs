use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

pub struct TextInjector {
    enigo: Enigo,
}

impl TextInjector {
    pub fn new() -> Result<Self, String> {
        let settings = Settings::default();
        let enigo =
            Enigo::new(&settings).map_err(|e| format!("Failed to initialize enigo: {:?}", e))?;

        Ok(Self { enigo })
    }

    pub fn type_text(&mut self, text: &str, delay_ms: u64) -> Result<(), String> {
        // Replace newlines with spaces to avoid accidental Enter keypresses
        let sanitized_text = text.replace('\n', " ").replace('\r', " ");
        eprintln!("🔤 Typing text (char-by-char): \"{}\"", sanitized_text);

        // Character-by-character for reliability (enigo.text() is buggy on Windows)
        for c in sanitized_text.chars() {
            if c == ' ' {
                self.enigo
                    .key(Key::Space, Direction::Press)
                    .map_err(|e| format!("Failed to press space: {:?}", e))?;
                self.enigo
                    .key(Key::Space, Direction::Release)
                    .map_err(|e| format!("Failed to release space: {:?}", e))?;
            } else {
                self.enigo
                    .text(&c.to_string())
                    .map_err(|e| format!("Failed to type character '{}': {:?}", c, e))?;
            }
            thread::sleep(Duration::from_millis(delay_ms));
        }

        eprintln!("✅ Text injection complete");
        Ok(())
    }

    pub fn type_text_with_newline(&mut self, text: &str, delay_ms: u64) -> Result<(), String> {
        self.type_text(text, delay_ms)?;

        thread::sleep(Duration::from_millis(delay_ms));
        self.enigo
            .key(Key::Return, Direction::Press)
            .map_err(|e| format!("Failed to press enter: {:?}", e))?;
        self.enigo
            .key(Key::Return, Direction::Release)
            .map_err(|e| format!("Failed to release enter: {:?}", e))?;

        Ok(())
    }
}
