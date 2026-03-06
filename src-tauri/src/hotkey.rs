use rdev::{listen, Event, EventType, Key};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use tracing::{debug, info, warn};

#[derive(Clone, Copy, Debug, Default)]
pub struct ModifierState {
    pub ctrl_pressed: bool,
    pub win_pressed: bool,
    pub alt_pressed: bool,
    pub is_recording: bool,
    pub is_agent_mode: bool,
}

pub struct HotkeyManager {
    state: Arc<Mutex<ModifierState>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl HotkeyManager {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(ModifierState::default())),
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.lock().expect("Failed to lock app_handle") = Some(handle);
    }

    pub fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let state = Arc::clone(&self.state);
        let app_handle = Arc::clone(&self.app_handle);

        thread::spawn(move || {
            info!("Starting keyboard event listener");

            if let Err(error) = listen(move |event| {
                Self::handle_event(event, &state, &app_handle);
            }) {
                warn!("Error in keyboard listener: {:?}", error);
            }
        });

        Ok(())
    }

    fn handle_event(
        event: Event,
        state: &Arc<Mutex<ModifierState>>,
        app_handle: &Arc<Mutex<Option<AppHandle>>>,
    ) {
        match &event.event_type {
            EventType::KeyPress(key) => {
                let handle_guard = app_handle.lock().expect("Failed to lock app_handle");
                let Some(app) = handle_guard.as_ref() else {
                    return;
                };
                Self::handle_key_press(*key, state, app);
            }
            EventType::KeyRelease(key) => {
                let handle_guard = app_handle.lock().expect("Failed to lock app_handle");
                let Some(app) = handle_guard.as_ref() else {
                    return;
                };
                Self::handle_key_release(*key, state, app);
            }
            _ => {}
        }
    }

    fn handle_key_press(key: Key, state: &Arc<Mutex<ModifierState>>, app: &AppHandle) {
        let mut st = state.lock().expect("Failed to lock modifier state");

        match key {
            Key::ControlLeft | Key::ControlRight => {
                st.ctrl_pressed = true;
                debug!("Ctrl pressed");
            }
            Key::MetaLeft | Key::MetaRight => {
                st.win_pressed = true;
                debug!("Win pressed");
            }
            Key::Alt | Key::AltGr => {
                st.alt_pressed = true;
                debug!("Alt pressed");
            }
            _ => {
                return;
            }
        }

        // Check for recording start combinations
        if !st.is_recording {
            if st.ctrl_pressed && st.win_pressed && st.alt_pressed {
                info!("Ctrl+Win+Alt pressed - Starting agent mode");
                let _ = app.emit("agent-mode-started", ());
                st.is_recording = true;
                st.is_agent_mode = true;
            } else if st.ctrl_pressed && st.win_pressed {
                info!("Ctrl+Win pressed - Starting recording");
                let _ = app.emit("recording-started", ());
                st.is_recording = true;
            }
        }
    }

    fn handle_key_release(key: Key, state: &Arc<Mutex<ModifierState>>, app: &AppHandle) {
        let mut st = state.lock().expect("Failed to lock modifier state");

        match key {
            Key::ControlLeft | Key::ControlRight => {
                st.ctrl_pressed = false;
                if st.is_recording {
                    info!("Ctrl released - Stopping recording");
                    let _ = app.emit("recording-stopped", false);
                    st.is_recording = false;
                    st.is_agent_mode = false;
                }
            }
            Key::MetaLeft | Key::MetaRight => {
                st.win_pressed = false;
                debug!("Win released");
                if st.is_recording && !st.ctrl_pressed {
                    info!("Win released (no Ctrl) - Stopping recording");
                    let _ = app.emit("recording-stopped", false);
                    st.is_recording = false;
                    st.is_agent_mode = false;
                }
            }
            Key::Alt | Key::AltGr => {
                st.alt_pressed = false;
                if st.is_recording && st.ctrl_pressed && st.win_pressed {
                    info!("Alt released - Stopping recording");
                    let _ = app.emit("recording-stopped", false);
                    st.is_recording = false;
                    st.is_agent_mode = false;
                }
            }
            _ => {}
        }
    }
}

pub fn setup_hotkeys(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let manager = HotkeyManager::new();
    manager.set_app_handle(app.clone());
    manager.start()?;

    Ok(())
}
