use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentResponse {
    pub response: String,
    pub tool_calls: Vec<ToolCall>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolCall {
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    response: String,
}

#[derive(Clone)]
pub struct AgentManager {
    client: Client,
    ollama_url: String,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            ollama_url: "http://localhost:11434".to_string(),
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        // No longer need to spawn a process since we're natively hitting Ollama
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        Ok(())
    }

    pub async fn send_prompt(&self, prompt: &str) -> Result<AgentResponse, String> {
        let req = OllamaRequest {
            model: "llama3.2".to_string(),
            prompt: prompt.to_string(),
            stream: false,
        };

        let response = self
            .client
            .post(format!("{}/api/generate", self.ollama_url))
            .header("Content-Type", "application/json")
            .body(serde_json::to_string(&req).map_err(|e| format!("Failed to serialize: {}", e))?)
            .send()
            .await
            .map_err(|e| format!("Failed to send prompt to Ollama: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Ollama returned error: {}", response.status()));
        }

        let ollama_resp: OllamaResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        Ok(AgentResponse {
            response: ollama_resp.response,
            tool_calls: vec![],
        })
    }

    pub fn is_running(&self) -> bool {
        // Native agent is always "running" since it just issues HTTP requests
        true
    }
}
