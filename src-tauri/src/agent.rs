use adk_rust::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio_stream::StreamExt;
use adk_runner::{Runner, RunnerConfig};
use adk_session::{CreateRequest, InMemorySessionService, SessionService};
use std::collections::HashMap;
use tokio::sync::oneshot;
use std::sync::Mutex;

// Tools

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
struct OpenAppArgs {
    /// Name of the application or command to open/run
    app_name: String,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
struct SystemSettingsArgs {
    /// The system setting to adjust. Always use "volume" for volume control.
    setting: String,
    /// What to do with the volume: "increase" (makes louder), "decrease" (makes quieter), "set" (exact level), or "mute" (toggle on/off)
    action: String,
    /// The exact volume percentage (0-100). Required when action is "set". Example: 50 for 50% volume.
    level: Option<u32>,
    /// How much to change volume by (0-100). Optional for "increase" or "decrease". Default is 20.
    amount: Option<u32>,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
struct TakeScreenshotArgs {}

#[derive(Clone)]
pub struct AgentManager {
    #[allow(dead_code)]
    ollama_url: String,
    model_name: String,
    pub pending_approvals: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    pub approval_window_ready: Arc<Mutex<Option<oneshot::Sender<()>>>>,
}

async fn request_approval(
    pending_approvals: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    approval_window_ready: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    app: AppHandle,
    tool_name: &str,
    args: serde_json::Value,
) -> bool {
    let (tx, rx) = oneshot::channel();
    static APPROVAL_ID: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let id = APPROVAL_ID.fetch_add(1, std::sync::atomic::Ordering::SeqCst).to_string();

    {
        let mut map = pending_approvals.lock().unwrap();
        map.insert(id.clone(), tx);
    }

    // Create a channel to wait for approval window ready signal
    let (ready_tx, mut ready_rx) = oneshot::channel();
    {
        let mut ready = approval_window_ready.lock().unwrap();
        *ready = Some(ready_tx);
    }

    // Show and focus the approval window
    if let Some(approval_window) = app.get_webview_window("approval") {
        let _ = approval_window.show();
        let _ = approval_window.set_focus();
        let _ = approval_window.set_always_on_top(true);
    }

    // Wait for approval window to be ready (with 2 second timeout)
    let ready_timeout = tokio::time::Duration::from_secs(2);
    let _ = tokio::time::timeout(ready_timeout, &mut ready_rx).await;

    let _ = app.emit("tool-approval-requested", serde_json::json!({
        "id": id,
        "tool": tool_name,
        "args": args
    }));

    let approved = rx.await.unwrap_or(false);
    
    // Wait a bit after approval is resolved to allow the window to close
    // This ensures screenshots and other tools don't capture the approval window
    if approved {
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
    }
    
    approved
}

// Browser launching helper functions

fn matches_default_browser_alias(input: &str) -> bool {
    matches!(input,
        "browser" | "my browser" | "default browser" |
        "zen" | "zen-browser" | "zen browser"
    )
}

fn is_url_like(input: &str) -> bool {
    input.contains("://") ||
    input.contains('.') && input.split('.').count() >= 2
}

fn is_known_domain(input: &str) -> bool {
    let known_domains = [
        "youtube", "google", "github", "reddit", "twitter", "x.com",
        "facebook", "instagram", "linkedin", "amazon", "netflix",
        "twitch", "discord", "spotify", "wikipedia", "stackoverflow"
    ];
    
    let input_lower = input.to_lowercase();
    known_domains.iter().any(|&domain| {
        input_lower == domain || input_lower.starts_with(&format!("{}.", domain))
    })
}

fn ensure_https_prefix(input: &str) -> String {
    if input.starts_with("http://") || input.starts_with("https://") {
        input.to_string()
    } else {
        format!("https://{}", input)
    }
}

fn resolve_and_launch(input: &str) -> std::result::Result<String, String> {
    let input_lower = input.to_lowercase();
    let input_trimmed = input.trim();

    // 1. Default browser aliases
    if matches_default_browser_alias(input_trimmed) {
        open::that("https://google.com").map_err(|e| format!("Failed to open browser: {}", e))?;
        return Ok("Opened default browser".to_string());
    }

    // 2. Check if input looks like URL or domain
    if is_url_like(input_trimmed) || is_known_domain(input_trimmed) {
        let url = ensure_https_prefix(input_trimmed);
        open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))?;
        return Ok(format!("Opened {}", url));
    }

    // 3. Check for "browser + url" pattern
    if let Some(rest) = input_lower.strip_prefix("open ") {
        if let Some(browser_part) = rest.split_whitespace().next() {
            if matches_default_browser_alias(browser_part) {
                let url_part = rest[browser_part.len()..].trim();
                if !url_part.is_empty() {
                    let url = ensure_https_prefix(url_part);
                    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))?;
                    return Ok(format!("Opened {}", url));
                }
            }
        }
    }

    // 4. Fallback: try raw input with default handler
    open::that(input_trimmed).map_err(|e| format!("Failed to open {}: {}", input_trimmed, e))?;
    Ok(format!("Opened: {}", input_trimmed))
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            ollama_url: "http://localhost:11434".to_string(),
            model_name: "functiongemma".to_string(),
            pending_approvals: Arc::new(Mutex::new(HashMap::new())),
            approval_window_ready: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&mut self) -> std::result::Result<(), String> {
        Ok(())
    }

    pub fn stop(&mut self) -> std::result::Result<(), String> {
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        true
    }

    pub fn resolve_approval(&self, id: &str, approved: bool) -> std::result::Result<(), String> {
        let mut map = self.pending_approvals.lock().unwrap();
        if let Some(tx) = map.remove(id) {
            let _ = tx.send(approved);
            Ok(())
        } else {
            Err("Approval ID not found".to_string())
        }
    }

    pub async fn handle_agent_request(&self, prompt: &str, app: AppHandle) -> std::result::Result<(), String> {
        eprintln!("🤖 handle_agent_request called with prompt: {}", prompt);
        
        // Initialize model
        let model = OllamaModel::new(OllamaConfig::new(&self.model_name)).map_err(|e| e.to_string())?;
        eprintln!("✅ OllamaModel initialized");

        // Instantiate tools via FunctionTool
        let pending = self.pending_approvals.clone();
        let ready = self.approval_window_ready.clone();
        eprintln!("🔧 Creating tools...");
        let app_clone = app.clone();
        let open_app_tool = FunctionTool::new(
            "open_application",
            "Open an application or run a command",
            move |_ctx, args| {
                let app_name = args.get("app_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let pending = pending.clone();
                let ready = ready.clone();
                let app_handle = app_clone.clone();
                let args_val = args.clone();
                
                async move {
                    if !request_approval(pending, ready, app_handle, "open_application", args_val).await {
                        return Ok(serde_json::json!({ "status": "error", "message": "User denied execution" }));
                    }

                    println!("Executing tool: open_application with args: {:?}", app_name);

                    match resolve_and_launch(&app_name) {
                        Ok(message) => Ok(serde_json::json!({ "status": "success", "message": message })),
                        Err(e) => Ok(serde_json::json!({ "status": "error", "message": format!("Failed to open {}: {}", app_name, e) })),
                    }
                }
            }
        ).with_parameters_schema::<OpenAppArgs>();

        let pending = self.pending_approvals.clone();
        let ready = self.approval_window_ready.clone();
        let app_clone = app.clone();
        let sys_set_tool = FunctionTool::new(
            "system_settings",
            "Adjust the system volume. IMPORTANT: Always set 'setting' to 'volume'. Use 'action' to specify what to do: 'set' (for exact level like 50%), 'increase' (to make louder), 'decrease' (to make quieter), or 'mute' (to toggle). Examples: setting='volume', action='set', level=50 OR setting='volume', action='increase', amount=20",
            move |_ctx, args| {
                let setting = args.get("setting").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let action = args.get("action").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let pending = pending.clone();
                let ready = ready.clone();
                let app_handle = app_clone.clone();
                let args_val = args.clone();
                
                async move {
                    if !request_approval(pending, ready, app_handle, "system_settings", args_val).await {
                        return Ok(serde_json::json!({ "status": "error", "message": "User denied execution" }));
                    }

                    println!("Executing tool: system_settings with setting: {}, action: {}", setting, action);
                    
                    if setting.to_lowercase() == "volume" {
                        use crate::volume;
                        let action_lower = action.to_lowercase();
                        
                        match action_lower.as_str() {
                            "increase" => {
                                // Increase by specific amount if provided, default to 20%
                                let amount = args.get("amount").and_then(|v| v.as_u64()).unwrap_or(20) as u32;
                                match volume::increase_volume_by(amount) {
                                    Ok(new_level) => Ok(serde_json::json!({ 
                                        "status": "success", 
                                        "message": format!("Increased volume to {}%", new_level) 
                                    })),
                                    Err(e) => Ok(serde_json::json!({ 
                                        "status": "error", 
                                        "message": format!("Failed to increase volume: {}", e) 
                                    }))
                                }
                            },
                            "decrease" => {
                                // Decrease by specific amount if provided, default to 20%
                                let amount = args.get("amount").and_then(|v| v.as_u64()).unwrap_or(20) as u32;
                                match volume::decrease_volume_by(amount) {
                                    Ok(new_level) => Ok(serde_json::json!({ 
                                        "status": "success", 
                                        "message": format!("Decreased volume to {}%", new_level) 
                                    })),
                                    Err(e) => Ok(serde_json::json!({ 
                                        "status": "error", 
                                        "message": format!("Failed to decrease volume: {}", e) 
                                    }))
                                }
                            },
                            "mute" | "unmute" | "toggle" => {
                                match volume::toggle_mute() {
                                    Ok(is_muted) => {
                                        let status = if is_muted { "muted" } else { "unmuted" };
                                        Ok(serde_json::json!({ 
                                            "status": "success", 
                                            "message": format!("System {}", status) 
                                        }))
                                    },
                                    Err(e) => Ok(serde_json::json!({ 
                                        "status": "error", 
                                        "message": format!("Failed to toggle mute: {}", e) 
                                    }))
                                }
                            },
                            "set" => {
                                // Set to exact level
                                let level = args.get("level").and_then(|v| v.as_u64()).unwrap_or(50).clamp(0, 100) as u32;
                                match volume::set_volume(level) {
                                    Ok(_) => Ok(serde_json::json!({ 
                                        "status": "success", 
                                        "message": format!("Volume set to exactly {}%", level) 
                                    })),
                                    Err(e) => Ok(serde_json::json!({ 
                                        "status": "error", 
                                        "message": format!("Failed to set volume: {}", e) 
                                    }))
                                }
                            },
                            _ => Ok(serde_json::json!({ 
                                "status": "error", 
                                "message": "Unknown action for volume. Use: increase, decrease, mute, unmute, toggle, or set" 
                            }))
                        }
                    } else {
                        Ok(serde_json::json!({ 
                            "status": "error", 
                            "message": format!("Setting '{}' is not supported. Only 'volume' is currently available.", setting) 
                        }))
                    }
                }
            }
        ).with_parameters_schema::<SystemSettingsArgs>();

        let pending = self.pending_approvals.clone();
        let ready = self.approval_window_ready.clone();
        let app_clone = app.clone();
        let screen_tool = FunctionTool::new(
            "take_screenshot",
            "Take a screenshot of the primary monitor and display it to the user. The image will open in the default image viewer. NOTE: You cannot see or analyze images - use this only when the user explicitly requests a screenshot be taken and shown to them.",
            move |_ctx, args| {
                let pending = pending.clone();
                let ready = ready.clone();
                let app_handle = app_clone.clone();
                let args_val = args.clone();
                
                async move {
                    if !request_approval(pending, ready, app_handle, "take_screenshot", args_val).await {
                        return Ok(serde_json::json!({ "status": "error", "message": "User denied execution" }));
                    }

                    println!("Executing tool: take_screenshot");
                    use xcap::Monitor;
                    let monitors = Monitor::all().unwrap_or_default();
                    if let Some(monitor) = monitors.first() {
                        let image = monitor.capture_image();
                        match image {
                            Ok(img) => {
                                let path = std::env::temp_dir().join("jarvis_screenshot.png");
                                if let Err(e) = img.save(&path) {
                                    return Ok(serde_json::json!({ "status": "error", "message": format!("Failed to save screenshot: {}", e) }));
                                }
                                
                                // Open the saved screenshot
                                let _ = open::that(&path);
                                
                                return Ok(serde_json::json!({ "status": "success", "message": format!("Screenshot saved to {:?}", path) }));
                            }
                            Err(e) => {
                                return Ok(serde_json::json!({ "status": "error", "message": format!("Failed to capture screen: {}", e) }));
                            }
                        }
                    }
                    Ok(serde_json::json!({ "status": "error", "message": "No monitors found" }))
                }
            }
        ).with_parameters_schema::<TakeScreenshotArgs>();

        // Build Agent
        let agent = LlmAgentBuilder::new("jarvis")
            .instruction("You are Jarvis, a helpful local AI assistant. You can control the system, open applications, take screenshots, and adjust volume using the provided tools. IMPORTANT: You cannot see or analyze images - if asked about something on screen, respond that you cannot see and ask the user to describe it. Be concise and helpful.")
            .model(Arc::new(model))
            .tool(Arc::new(open_app_tool))
            .tool(Arc::new(sys_set_tool))
            .tool(Arc::new(screen_tool))
            .build()
            .map_err(|e| e.to_string())?;

        let session_service = Arc::new(InMemorySessionService::new());

        // Create a session
        let session = session_service
            .create(CreateRequest {
                app_name: "jarvis".to_string(),
                user_id: "user_1".to_string(),
                session_id: None,
                state: std::collections::HashMap::new(),
            })
            .await
            .map_err(|e| e.to_string())?;

        // Configure and create runner
        let runner = Runner::new(RunnerConfig {
            app_name: "jarvis".to_string(),
            agent: Arc::new(agent),
            session_service,
            artifact_service: None,
            memory_service: None,
            plugin_manager: None,
            run_config: None,
            compaction_config: None,
            cache_capable: None,
            cancellation_token: None,
            context_cache_config: None,
            request_context: None,
        }).map_err(|e| e.to_string())?;
        eprintln!("✅ Runner created");

        // Execute agent with streaming response
        let user_content = adk_core::Content::new("user").with_text(prompt);
        eprintln!("📤 Calling runner.run()...");
        let mut stream = runner.run(
            "user_1".to_string(),
            session.id().to_string(),
            user_content,
        ).await.map_err(|e| e.to_string())?;
        eprintln!("✅ runner.run() returned successfully, processing stream...");

        let mut full_response = String::new();
        let mut event_count = 0;

        eprintln!("🔄 Starting to process stream events...");
        while let Some(event) = stream.next().await {
            event_count += 1;
            if event_count % 10 == 0 {
                eprintln!("📊 Processed {} events so far...", event_count);
            }
            if let Ok(e) = event {
                if let Some(content) = e.llm_response.content {
                    for part in content.parts {
                        if let adk_core::Part::Text { text } = part {
                            full_response.push_str(&text);
                        }
                    }
                }
            }
        }
        eprintln!("✅ Stream processing complete. Total events: {}. Response length: {} chars", event_count, full_response.len());

        // Sanitize the response from functiongemma
        // Functiongemma sometimes includes internal tokens like <start_of_turn> or <escape>
        // We will do a basic string replacement to clean it up before sending to the frontend.
        let mut clean_response = full_response;
        let tokens_to_remove = [
            "<start_of_turn>", "<end_of_turn>", "model\n", "<escape>", "<eos>", "<bos>", "<pad>"
        ];
        for token in tokens_to_remove {
            clean_response = clean_response.replace(token, "");
        }
        clean_response = clean_response.trim().to_string();

        // Emit result back to frontend and show response window
        println!("Agent response: {}", clean_response);
        
        // Show agent response window
        if let Some(response_window) = app.get_webview_window("agent-response") {
            // Update the webview with the message via a custom event
            let _ = app.emit("agent-response-data", clean_response.clone());
            
            // Position the window in the bottom right corner
            if let Some(monitor) = response_window.current_monitor().ok().flatten().or_else(|| response_window.primary_monitor().ok().flatten()) {
                let monitor_pos = monitor.position();
                let monitor_size = monitor.size();
                
                // Typical size from config is 420x120, plus some padding
                let window_width = 420;
                let window_height = 120;
                let padding_x = 24;
                let padding_y = 48; // Space from bottom (taskbar area)
                
                let x = monitor_pos.x + monitor_size.width as i32 - window_width - padding_x;
                let y = monitor_pos.y + monitor_size.height as i32 - window_height - padding_y;
                
                let _ = response_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
            }

            let _ = response_window.show();
            let _ = response_window.set_always_on_top(true);
            
            // Auto-hide after 10 seconds
            let app_clone = app.clone();
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                if let Some(window) = app_clone.get_webview_window("agent-response") {
                    let _ = window.hide();
                }
            });
        }
        
        let _ = app.emit("agent-response", clean_response);

        Ok(())
    }

    pub async fn send_prompt(&self, _prompt: &str) -> std::result::Result<AgentResponse, String> {
        Ok(AgentResponse {
            response: "This endpoint is deprecated. Use handle_agent_request instead.".to_string(),
            tool_calls: vec![],
        })
    }
}

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
