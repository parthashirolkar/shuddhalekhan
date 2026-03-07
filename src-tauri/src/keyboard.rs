use winput::Vk;

pub struct TextInjector {}

impl TextInjector {
    pub fn new() -> Result<Self, String> {
        Ok(Self {})
    }

    pub fn type_text(&mut self, text: &str, _delay_ms: u64) -> Result<(), String> {
        let sanitized_text = text.replace(['\n', '\r'], " ");
        eprintln!("🔤 Typing text: \"{}\"", sanitized_text);
        winput::send_str(&sanitized_text);
        eprintln!("✅ Text injection complete");
        Ok(())
    }

    pub fn type_text_with_newline(&mut self, text: &str, _delay_ms: u64) -> Result<(), String> {
        self.type_text(text, _delay_ms)?;
        winput::send(Vk::Enter);
        Ok(())
    }
}
