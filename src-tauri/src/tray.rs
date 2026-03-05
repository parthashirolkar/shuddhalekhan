use crate::AppState;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<AppState>();

    // Get list of devices
    let devices = {
        let audio_manager = state.audio_manager.lock().unwrap();
        audio_manager.get_input_devices().unwrap_or_default()
    };

    let mut device_submenu = SubmenuBuilder::new(app, "Audio Devices");

    for device_name in devices {
        // We encode the device name in the ID so we can retrieve it
        let id = format!("device_{}", device_name);
        let item = MenuItem::with_id(app, id, &device_name, true, None::<&str>)?;
        device_submenu = device_submenu.item(&item);
    }

    let select_device_submenu = device_submenu.build()?;

    let separator = PredefinedMenuItem::separator(app)?;
    let exit_item = MenuItem::with_id(app, "exit", "Exit", true, Some("cmd+q"))?;

    // Create menu
    let menu = Menu::with_items(app, &[&select_device_submenu, &separator, &exit_item])?;

    // Build tray icon
    let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-icon.ico"))
        .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })?;

    let _tray = TrayIconBuilder::new()
        .icon(tray_icon)
        .menu(&menu)
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            if id.starts_with("device_") {
                let device_name = id.trim_start_matches("device_").to_string();
                let audio_manager_arc = app.state::<AppState>().audio_manager.clone();
                let config_arc = app.state::<AppState>().config.clone();

                // Update device in audio manager
                if let Ok(mut audio_manager) = audio_manager_arc.lock() {
                    if let Err(e) = audio_manager.set_device(&device_name) {
                        eprintln!("Failed to set audio device: {}", e);
                    }
                }

                // Update device in config
                if let Ok(mut config) = config_arc.lock() {
                    let _ = config.update_selected_device(device_name);
                };
            } else if id == "exit" {
                app.exit(0);
            }
        })
        .build(app)?;

    Ok(())
}
