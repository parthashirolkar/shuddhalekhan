mod audio;
mod keyboard;

use audio::AudioManager;
use keyboard::TextInjector;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    pub audio_manager: Arc<Mutex<AudioManager>>,
    pub text_injector: Arc<Mutex<TextInjector>>,
}

#[tauri::command]
fn get_audio_devices(state: State<AppState>) -> Result<Vec<String>, String> {
    let audio_manager = state.audio_manager.lock().expect("Failed to lock audio_manager");
    audio_manager.get_input_devices()
}

#[tauri::command]
fn select_audio_device(device_name: String, state: State<AppState>) -> Result<(), String> {
    let mut audio_manager = state.audio_manager.lock().expect("Failed to lock audio_manager");
    audio_manager.set_device(&device_name)
}

#[tauri::command]
fn start_recording(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let audio_manager = state.audio_manager.lock().expect("Failed to lock audio_manager");
    audio_manager.start_recording(app)?;
    Ok(())
}

#[tauri::command]
fn inject_text(text: String, _with_newline: bool, state: State<AppState>) -> Result<(), String> {
    let mut text_injector = state.text_injector.lock().expect("Failed to lock text_injector");
    // 15ms delay is chosen as a sweet spot between perceived instant typing
    // and reliability across different target applications (some drop keystrokes if too fast).
    text_injector.type_text(&text, 15)?;
    Ok(())
}

#[tauri::command]
async fn stop_recording(state: State<'_, AppState>) -> Result<Vec<u8>, String> {
    let mut audio_manager = state.audio_manager.lock().expect("Failed to lock audio_manager");
    
    // Stop recording and get the raw WAV bytes back
    let wav_data = audio_manager.stop_recording()?;
    
    // We now just return the wav_data directly to the frontend.
    // The frontend will handle the HTTP request to Whisper.
    Ok(wav_data)
}

// The frontend now listens to the global shortcut and calls `stop_recording` directly.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let audio_manager = Arc::new(Mutex::new(
                AudioManager::new().expect("Failed to initialize audio manager"),
            ));

            // Initialize the audio stream permanently (zero-latency recording)
            {
                let audio_manager_init = audio_manager.lock().expect("Failed to lock audio manager for initialization");
                if let Err(e) = audio_manager_init.initialize_stream(app.handle().clone()) {
                    eprintln!("⚠️  Warning: Failed to initialize audio stream on startup: {}", e);
                    eprintln!("📝 The stream will be initialized on first recording instead.");
                }
            }

            let text_injector = Arc::new(Mutex::new(
                TextInjector::new().expect("Failed to initialize text injector"),
            ));

            let state = AppState {
                audio_manager: audio_manager.clone(),
                text_injector: text_injector.clone(),
            };

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_audio_devices,
            select_audio_device,
            start_recording,
            stop_recording,
            inject_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



