use winput::Vk;

pub struct TextInjector;

impl TextInjector {
    pub fn new() -> Result<Self, String> {
        Ok(Self)
    }

    pub fn type_text(&mut self, text: &str, _delay_ms: u64) -> Result<(), String> {
        // Replace newlines with spaces to avoid accidental Enter keypresses
        let sanitized_text = text.replace(['\n', '\r'], " ");
        eprintln!("🔤 Typing text (fast injection): \"{}\"", sanitized_text);

        // Synthesizes keystrokes following the given string reference.
        winput::send_str(&sanitized_text);

        eprintln!("✅ Text injection complete");
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
