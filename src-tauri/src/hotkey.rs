use rdev::{listen, Event, EventType, Key};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use tracing::{debug, info, warn};

/// Tracks which modifier keys are currently held down.
/// `is_recording` prevents firing start events repeatedly while held.
#[derive(Clone, Copy, Debug, Default)]
struct ModifierState {
    ctrl_pressed: bool,
    win_pressed: bool,
    alt_pressed: bool,
    is_recording: bool,
    is_agent_mode: bool,
}

impl ModifierState {
    /// Reset all modifier flags — called when focus is lost or state gets
    /// corrupted (e.g. Win key opens Start Menu and swallows the key-up).
    fn reset_modifiers(&mut self) {
        self.ctrl_pressed = false;
        self.win_pressed = false;
        self.alt_pressed = false;
    }
}

pub fn setup_hotkeys(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state: Arc<Mutex<ModifierState>> = Arc::new(Mutex::new(ModifierState::default()));
    let app_handle = app.clone();

    thread::spawn(move || {
        info!("Starting rdev keyboard event listener");

        if let Err(e) = listen(move |event: Event| {
            handle_event(event, &state, &app_handle);
        }) {
            warn!("rdev listener error: {:?}", e);
        }
    });

    Ok(())
}

fn handle_event(event: Event, state: &Arc<Mutex<ModifierState>>, app: &AppHandle) {
    match &event.event_type {
        EventType::KeyPress(key) => handle_key_press(*key, state, app),
        EventType::KeyRelease(key) => handle_key_release(*key, state, app),
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
        // If any non-modifier key is pressed while recording isn't active,
        // check if the Win key state is stale (Win key can get "stuck" open
        // when Windows intercepts it for the Start Menu in packaged builds).
        _ => {
            if !st.is_recording && st.win_pressed && !st.ctrl_pressed {
                debug!("Non-modifier key while Win stuck — resetting modifier state");
                st.reset_modifiers();
            }
            return;
        }
    }

    if st.is_recording {
        return;
    }

    let mut should_start_agent = false;
    let mut should_start_record = false;

    if st.ctrl_pressed && st.win_pressed && st.alt_pressed {
        st.is_recording = true;
        st.is_agent_mode = true;
        should_start_agent = true;
    } else if st.ctrl_pressed && st.win_pressed {
        st.is_recording = true;
        should_start_record = true;
    }

    drop(st); // Drop lock before emitting

    if should_start_agent {
        info!("Ctrl+Win+Alt pressed — Starting agent mode");
        let _ = app.emit("agent-mode-started", ());
    } else if should_start_record {
        info!("Ctrl+Win pressed — Starting recording");
        let _ = app.emit("recording-started", ());
    }
}

fn handle_key_release(key: Key, state: &Arc<Mutex<ModifierState>>, app: &AppHandle) {
    let mut st = state.lock().expect("Failed to lock modifier state");
    let mut should_stop_recording = false;

    match key {
        Key::ControlLeft | Key::ControlRight => {
            st.ctrl_pressed = false;
            if st.is_recording {
                info!("Ctrl released — Stopping recording");
                should_stop_recording = true;
            }
        }
        Key::MetaLeft | Key::MetaRight => {
            st.win_pressed = false;
            debug!("Win released");
            // Stop recording if Ctrl is also released or not held
            if st.is_recording && !st.ctrl_pressed {
                info!("Win released (Ctrl not held) — Stopping recording");
                should_stop_recording = true;
            }
        }
        Key::Alt | Key::AltGr => {
            st.alt_pressed = false;
            if st.is_recording && st.is_agent_mode {
                info!("Alt released — Stopping agent mode recording");
                should_stop_recording = true;
            }
        }
        _ => {}
    }

    if should_stop_recording {
        st.is_recording = false;
        st.is_agent_mode = false;
        drop(st); // Drop lock before emitting
        let _ = app.emit("recording-stopped", false);
    }
}
