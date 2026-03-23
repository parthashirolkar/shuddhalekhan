use winput::Vk;

pub struct TextInjector;

impl TextInjector {
    pub fn new() -> Result<Self, String> {
        Ok(Self)
    }

    pub fn type_text(&mut self, text: &str, delay_ms: u64) -> Result<(), String> {
        // Replace newlines with spaces to avoid accidental Enter keypresses
        let sanitized_text = text.replace(['\n', '\r'], " ");
        eprintln!("🔤 Typing text: \"{}\"", sanitized_text);

        // Send characters one at a time with delay to prevent dropped keystrokes
        // This is more reliable than send_str which sends all at once
        let delay = std::time::Duration::from_millis(delay_ms);
        for c in sanitized_text.chars() {
            winput::send(c);
            if delay_ms > 0 {
                std::thread::sleep(delay);
            }
        }

        eprintln!(
            "✅ Text injection complete: {} characters",
            sanitized_text.len()
        );
        Ok(())
    }

    pub fn type_text_with_newline(&mut self, text: &str, delay_ms: u64) -> Result<(), String> {
        self.type_text(text, delay_ms)?;

        // Small delay before pressing Enter
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        winput::send(Vk::Enter);

        Ok(())
    }
}
