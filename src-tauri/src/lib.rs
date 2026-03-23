mod agent;
mod audio;
mod config;
mod hotkey;
mod keyboard;
mod tray;
mod volume;
mod whisper;

use agent::AgentManager;
use audio::AudioManager;
use config::Config;
use keyboard::TextInjector;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Listener, Manager, PhysicalPosition, Position, State, WebviewWindow};
use whisper::WhisperClient;

pub struct AppState {
    pub audio_manager: Arc<Mutex<AudioManager>>,
    pub text_injector: Arc<Mutex<TextInjector>>,
    pub whisper_client: Arc<Mutex<WhisperClient>>,
    pub config: Arc<Mutex<Config>>,
    pub agent_manager: Arc<Mutex<AgentManager>>,
}

#[tauri::command]
fn get_audio_devices(state: State<AppState>) -> Result<Vec<String>, String> {
    let audio_manager = state
        .audio_manager
        .lock()
        .expect("Failed to lock audio_manager");
    audio_manager.get_input_devices()
}

#[tauri::command]
fn select_audio_device(device_name: String, state: State<AppState>) -> Result<(), String> {
    let mut audio_manager = state
        .audio_manager
        .lock()
        .expect("Failed to lock audio_manager");
    audio_manager.set_device(&device_name)?;

    let mut config = state.config.lock().expect("Failed to lock config");
    config.update_selected_device(device_name)
}

#[tauri::command]
fn start_recording(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let audio_manager = state
        .audio_manager
        .lock()
        .expect("Failed to lock audio_manager");
    audio_manager.start_recording(app)?;
    Ok(())
}

#[tauri::command]
async fn stop_recording(state: State<'_, AppState>) -> Result<String, String> {
    let audio_data = {
        let mut audio_manager = state
            .audio_manager
            .lock()
            .expect("Failed to lock audio_manager");
        audio_manager.stop_recording()?
    };

    let remove_filler_words = {
        let config = state.config.lock().expect("Failed to lock config");
        config.remove_filler_words
    };

    let whisper_client = {
        state
            .whisper_client
            .lock()
            .expect("Failed to lock whisper_client")
            .clone()
    };
    let text = whisper_client.transcribe(&audio_data, remove_filler_words).await?;

    let text = if remove_filler_words {
        whisper::clean_filler_words(&text)
    } else {
        text
    };

    Ok(text)
}

#[tauri::command]
fn inject_text(text: String, _with_newline: bool, state: State<AppState>) -> Result<(), String> {
    let mut text_injector = state
        .text_injector
        .lock()
        .expect("Failed to lock text_injector");
    // 15ms delay is chosen as a sweet spot between perceived instant typing
    // and reliability across different target applications (some drop keystrokes if too fast).
    text_injector.type_text(&text, 15)?;
    Ok(())
}

#[tauri::command]
fn get_config(state: State<AppState>) -> Result<Config, String> {
    let config = state.config.lock().expect("Failed to lock config");
    Ok(config.clone())
}

#[tauri::command]
fn update_whisper_url(url: String, state: State<AppState>) -> Result<(), String> {
    let mut config = state.config.lock().expect("Failed to lock config");
    config.update_whisper_url(url.clone())?;

    drop(config);

    let mut whisper_client = state
        .whisper_client
        .lock()
        .expect("Failed to lock whisper_client");
    whisper_client.set_url(url);

    Ok(())
}

#[tauri::command]
async fn agent_prompt(prompt: String, state: State<'_, AppState>) -> Result<String, String> {
    {
        let mut agent_manager = state
            .agent_manager
            .lock()
            .expect("Failed to lock agent_manager");
        if !agent_manager.is_running() {
            agent_manager.start()?;
        }
    }

    let agent_manager = {
        state
            .agent_manager
            .lock()
            .expect("Failed to lock agent_manager")
            .clone()
    };
    let response = agent_manager.send_prompt(&prompt).await?;
    Ok(response.response)
}

#[tauri::command]
fn resolve_tool_approval(id: String, approved: bool, state: State<AppState>, app: AppHandle) -> Result<(), String> {
    let agent_manager = state.agent_manager.lock().expect("Failed to lock agent_manager");
    let result = agent_manager.resolve_approval(&id, approved);
    
    // Hide the approval window after resolution
    if let Some(approval_window) = app.get_webview_window("approval") {
        let _ = approval_window.hide();
    }
    
    result
}

fn position_recording_window(window: &WebviewWindow) {
    const BOTTOM_MARGIN: i32 = 48;

    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return;
    };

    let monitor_pos = monitor.position();
    let monitor_size = monitor.size();
    let window_size = window.outer_size().ok();

    let window_width = window_size.map(|size| size.width as i32).unwrap_or(102);
    let window_height = window_size.map(|size| size.height as i32).unwrap_or(46);

    let x = monitor_pos.x + ((monitor_size.width as i32 - window_width) / 2).max(0);
    let min_y = monitor_pos.y;
    let target_y = monitor_pos.y + monitor_size.height as i32 - window_height - BOTTOM_MARGIN;
    let y = target_y.max(min_y);

    let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = Config::load().unwrap_or_default();
    let whisper_url = config.whisper_url.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let audio_manager = Arc::new(Mutex::new(
                AudioManager::new().expect("Failed to initialize audio manager"),
            ));

            // Initialize the audio stream permanently (zero-latency recording)
            {
                let audio_manager_init = audio_manager
                    .lock()
                    .expect("Failed to lock audio manager for initialization");
                if let Err(e) = audio_manager_init.initialize_stream(app.handle().clone()) {
                    eprintln!(
                        "⚠️  Warning: Failed to initialize audio stream on startup: {}",
                        e
                    );
                    eprintln!("📝 The stream will be initialized on first recording instead.");
                }
            }

            let text_injector = Arc::new(Mutex::new(
                TextInjector::new().expect("Failed to initialize text injector"),
            ));

            let whisper_client = Arc::new(Mutex::new(
                WhisperClient::new(whisper_url).expect("Failed to initialize whisper client"),
            ));

            let agent_manager = Arc::new(Mutex::new(AgentManager::new()));

            let state = AppState {
                audio_manager: audio_manager.clone(),
                text_injector: text_injector.clone(),
                whisper_client: whisper_client.clone(),
                config: Arc::new(Mutex::new(config)),
                agent_manager: agent_manager.clone(),
            };

            let audio_manager_start = audio_manager.clone();
            let audio_manager_stop = audio_manager.clone();
            let text_injector_stop = text_injector.clone();
            let whisper_client_stop = whisper_client.clone();
            let app_handle = app.handle();

            app.manage(state);

            app.listen("recording-started", {
                let audio_manager = audio_manager_start.clone();
                let app_handle = app_handle.clone();
                move |_event| {
                    eprintln!("🎤 Recording started event received");

                    if let Some(window) = app_handle.get_webview_window("recording") {
                        let _ = window.show();
                        // Position window after showing to ensure current_monitor() targets the correct display
                        // where the window natively spawned, rather than falling back prematurely.
                        position_recording_window(&window);

                        // On Windows, WebView2 has its own opaque default background that CSS
                        // transparency cannot override. We must explicitly set it to transparent
                        // via the ICoreWebView2Controller2::put_DefaultBackgroundColor API.
                        #[cfg(target_os = "windows")]
                        {
                            use webview2_com::Microsoft::Web::WebView2::Win32::{
                                ICoreWebView2Controller2, COREWEBVIEW2_COLOR,
                            };
                            use windows::core::Interface;
                            let _ = window.with_webview(|webview| unsafe {
                                if let Ok(controller2) = webview
                                    .controller()
                                    .cast::<ICoreWebView2Controller2>()
                                {
                                    let transparent = COREWEBVIEW2_COLOR {
                                        A: 0,
                                        R: 0,
                                        G: 0,
                                        B: 0,
                                    };
                                    let _ = controller2.SetDefaultBackgroundColor(transparent);
                                }
                            });
                        }
                    }

                    let am = audio_manager.lock().expect("Failed to lock audio manager");
                    if let Err(e) = am.start_recording(app_handle.clone()) {
                        eprintln!("❌ Failed to start recording: {}", e);
                    }
                }
            });

            let app_handle_stop = app_handle.clone();
            let config_for_stop = app.state::<AppState>().config.clone();
            let agent_manager_stop = agent_manager.clone();
            let _ = app.listen("recording-stopped", move |event| {
                eprintln!("🛑 Recording stopped event received");
                
                let payload = event.payload();
                let is_agent_mode = serde_json::from_str::<bool>(payload).unwrap_or(false);

                if let Some(window) = app_handle_stop.get_webview_window("recording") {
                    let _ = window.hide();
                }

                let audio_manager_bg = audio_manager_stop.clone();
                let whisper_client_bg = whisper_client_stop.clone();
                let text_injector_bg = text_injector_stop.clone();
                let config_bg = config_for_stop.clone();
                let agent_manager_bg = agent_manager_stop.clone();
                let app_handle_bg = app_handle_stop.clone();

                tauri::async_runtime::spawn(async move {
                    let audio_data: Vec<u8> = {
                        let mut audio_manager = audio_manager_bg
                            .lock()
                            .expect("Failed to lock audio manager (async)");
                        match audio_manager.stop_recording() {
                            Ok(data) => data,
                            Err(e) => {
                                eprintln!("❌ Failed to stop recording: {}", e);
                                return;
                            }
                        }
                    };

                    eprintln!("📝 Transcribing {} bytes of audio...", audio_data.len());

                    let remove_filler_words = {
                        let config = config_bg.lock().expect("Failed to lock config (async)");
                        config.remove_filler_words
                    };

                    let text = {
                        let whisper_client = whisper_client_bg
                            .lock()
                            .expect("Failed to lock whisper client (async)")
                            .clone();
                        match whisper_client.transcribe(&audio_data, remove_filler_words).await {
                            Ok(t) => t,
                            Err(e) => {
                                eprintln!("❌ Transcription failed: {}", e);
                                return;
                            }
                        }
                    };

                    let text = if remove_filler_words {
                        whisper::clean_filler_words(&text)
                    } else {
                        text
                    };

                    eprintln!("✅ Transcription: \"{}\"", text);
                    
                    if is_agent_mode {
                        eprintln!("🤖 Agent mode active, routing to agent manager...");
                        let am = agent_manager_bg.lock().unwrap().clone();
                        // Call the agent manager with the app handle for tool capabilities
                        if let Err(e) = am.handle_agent_request(&text, app_handle_bg.clone()).await {
                            eprintln!("❌ Agent failed: {}", e);
                        }
                    } else {
                        // Spawn blocking task to avoid blocking Tokio runtime
                        let text_injector_clone = text_injector_bg.clone();
                        let text_clone = text.clone();
                        let _ = tokio::task::spawn_blocking(move || {
                            let mut text_injector = text_injector_clone
                                .lock()
                                .expect("Failed to lock text injector");
                            if let Err(e) = text_injector.type_text(&text_clone, 15) {
                                eprintln!("❌ Failed to inject text: {}", e);
                            } else {
                                eprintln!("✅ Text injected successfully");
                            }
                        }).await;
                    }
                });
            });

            let agent_manager_ready = agent_manager.clone();
            let _ = app.listen("approval-window-ready", move |_event| {
                eprintln!("✅ Approval window ready signal received");
                let am = agent_manager_ready.lock().expect("Failed to lock agent_manager");
                let ready_tx = am.approval_window_ready.lock().unwrap().take();
                drop(am); // Drop the first lock
                if let Some(tx) = ready_tx {
                    let _ = tx.send(());
                }
            });

            tray::setup_tray(app.handle())?;
            hotkey::setup_hotkeys(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_audio_devices,
            select_audio_device,
            start_recording,
            stop_recording,
            inject_text,
            get_config,
            update_whisper_url,
            agent_prompt,
            resolve_tool_approval,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
