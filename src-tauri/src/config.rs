use dirs::home_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub whisper_url: String,
    pub selected_device: Option<String>,
    pub recording_hotkey_modifiers: Vec<String>,
    pub remove_filler_words: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            whisper_url: "http://localhost:8080/inference".to_string(),
            selected_device: None,
            recording_hotkey_modifiers: vec!["control".to_string(), "win".to_string()],
            remove_filler_words: true,
        }
    }
}

impl Config {
    pub fn get_config_dir() -> PathBuf {
        home_dir()
            .expect("Failed to get home directory")
            .join(".speech-2-text")
    }

    pub fn get_config_path() -> PathBuf {
        Self::get_config_dir().join("config.json")
    }

    pub fn load() -> Result<Self, String> {
        let config_path = Self::get_config_path();

        if !config_path.exists() {
            let default_config = Self::default();
            default_config.save()?;
            return Ok(default_config);
        }

        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;

        let config: Config =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;

        Ok(config)
    }

    pub fn save(&self) -> Result<(), String> {
        let config_dir = Self::get_config_dir();

        if !config_dir.exists() {
            fs::create_dir_all(&config_dir)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let config_path = Self::get_config_path();
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&config_path, content).map_err(|e| format!("Failed to write config: {}", e))?;

        Ok(())
    }

    pub fn update_selected_device(&mut self, device_name: String) -> Result<(), String> {
        self.selected_device = Some(device_name);
        self.save()
    }

    pub fn update_whisper_url(&mut self, url: String) -> Result<(), String> {
        self.whisper_url = url;
        self.save()
    }

    pub fn update_remove_filler_words(&mut self, enabled: bool) -> Result<(), String> {
        self.remove_filler_words = enabled;
        self.save()
    }
}
