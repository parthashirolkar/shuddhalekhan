mod audio;
mod config;
mod keyboard;
mod whisper;
mod hotkey;
mod tray;
mod agent;

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
    let audio_manager = state.audio_manager.lock().unwrap();
    audio_manager.get_input_devices()
}

#[tauri::command]
fn select_audio_device(device_name: String, state: State<AppState>) -> Result<(), String> {
    let mut audio_manager = state.audio_manager.lock().unwrap();
    audio_manager.set_device(&device_name)?;

    let mut config = state.config.lock().unwrap();
    config.update_selected_device(device_name)
}

#[tauri::command]
fn start_recording(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let audio_manager = state.audio_manager.lock().unwrap();
    audio_manager.start_recording(app)?;
    Ok(())
}

#[tauri::command]
fn stop_recording(state: State<AppState>) -> Result<String, String> {
    let mut audio_manager = state.audio_manager.lock().unwrap();
    let audio_data = audio_manager.stop_recording()?;

    drop(audio_manager);

    let whisper_client = state.whisper_client.lock().unwrap();
    let text = whisper_client.transcribe(&audio_data)?;

    Ok(text)
}

#[tauri::command]
fn inject_text(text: String, _with_newline: bool, state: State<AppState>) -> Result<(), String> {
    let mut text_injector = state.text_injector.lock().unwrap();
    text_injector.type_text(&text, 15)?;
    Ok(())
}

#[tauri::command]
fn get_config(state: State<AppState>) -> Result<Config, String> {
    let config = state.config.lock().unwrap();
    Ok(config.clone())
}

#[tauri::command]
fn update_whisper_url(url: String, state: State<AppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.update_whisper_url(url.clone())?;

    drop(config);

    let mut whisper_client = state.whisper_client.lock().unwrap();
    whisper_client.set_url(url);

    Ok(())
}

#[tauri::command]
async fn agent_prompt(prompt: String, state: State<'_, AppState>) -> Result<String, String> {
    {
        let agent_manager = state.agent_manager.lock().unwrap();
        if !agent_manager.is_running() {
            drop(agent_manager);
            let mut agent_manager = state.agent_manager.lock().unwrap();
            agent_manager.start()?;
        }
    }

    let agent_manager = state.agent_manager.lock().unwrap();
    let response = agent_manager.send_prompt(&prompt)?;
    Ok(response.response)
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let audio_manager = Arc::new(Mutex::new(
                AudioManager::new().expect("Failed to initialize audio manager"),
            ));

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
                agent_manager,
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
                        position_recording_window(&window);
                        let _ = window.show();
                    }

                    let am = audio_manager.lock().unwrap();
                    if let Err(e) = am.start_recording(app_handle.clone()) {
                        eprintln!("❌ Failed to start recording: {}", e);
                    }
                }
            });

            let app_handle_stop = app_handle.clone();
            let _ = app.listen("recording-stopped", move |_event| {
                eprintln!("🛑 Recording stopped event received");

                if let Some(window) = app_handle_stop.get_webview_window("recording") {
                    let _ = window.hide();
                }

                let audio_manager_bg = audio_manager_stop.clone();
                let whisper_client_bg = whisper_client_stop.clone();
                let text_injector_bg = text_injector_stop.clone();

                tauri::async_runtime::spawn_blocking(move || {
                    let mut audio_manager = audio_manager_bg.lock().unwrap();
                    let audio_data: Vec<u8> = match audio_manager.stop_recording() {
                        Ok(data) => data,
                        Err(e) => {
                            eprintln!("❌ Failed to stop recording: {}", e);
                            return;
                        }
                    };
                    drop(audio_manager);

                    eprintln!("📝 Transcribing {} bytes of audio...", audio_data.len());

                    let whisper_client = whisper_client_bg.lock().unwrap();
                    let text = match whisper_client.transcribe(&audio_data) {
                        Ok(t) => t,
                        Err(e) => {
                            eprintln!("❌ Transcription failed: {}", e);
                            return;
                        }
                    };
                    drop(whisper_client);

                    eprintln!("✅ Transcription: \"{}\"", text);

                    let mut text_injector = text_injector_bg.lock().unwrap();
                    if let Err(e) = text_injector.type_text(&text, 15) {
                        eprintln!("❌ Failed to inject text: {}", e);
                    } else {
                        eprintln!("✅ Text injected successfully");
                    }
                });
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



