use reqwest::blocking::{multipart, Client};
use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct WhisperResponse {
    pub text: String,
}

pub struct WhisperClient {
    client: Client,
    url: String,
}

impl WhisperClient {
    pub fn new(url: String) -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        Ok(Self { client, url })
    }

    pub fn transcribe(&self, audio_data: &[u8]) -> Result<String, String> {
        let part = multipart::Part::bytes(audio_data.to_vec())
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| format!("Failed to create mime part: {}", e))?;

        let form = multipart::Form::new()
            .part("file", part)
            .text("temperature", "0.0")
            .text("response_format", "json");

        let response = self
            .client
            .post(&self.url)
            .multipart(form)
            .send()
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Whisper API error: {} - {}", status, error_text));
        }

        let whisper_response: WhisperResponse = response
            .json()
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(whisper_response.text.trim().to_string())
    }

    pub fn set_url(&mut self, url: String) {
        self.url = url;
    }
}
