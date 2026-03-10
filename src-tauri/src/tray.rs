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
    let check_update_item = MenuItem::with_id(app, "check_update", "Check for Updates", true, None::<&str>)?;
    let exit_item = MenuItem::with_id(app, "exit", "Exit", true, Some("cmd+q"))?;

    // Create menu
    let menu = Menu::with_items(app, &[&select_device_submenu, &separator, &check_update_item, &exit_item])?;

    // Build tray icon
    #[cfg(target_os = "windows")]
    let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-icon.ico"))
        .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })?;

    #[cfg(not(target_os = "windows"))]
    let tray_icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))
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
            } else if id == "check_update" {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    use tauri_plugin_updater::UpdaterExt;
                    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

                    match app_handle.updater() {
                        Ok(updater) => {
                            match updater.check().await {
                                Ok(Some(update)) => {
                                    let message = format!(
                                        "Version {} is available. Do you want to download and install it?",
                                        update.version
                                    );
                                    let should_update = app_handle
                                        .dialog()
                                        .message(message)
                                        .title("Update Available")
                                        .kind(MessageDialogKind::Info)
                                        .buttons(MessageDialogButtons::OkCancel)
                                        .blocking_show();

                                    if should_update {
                                        match update.download_and_install(|_, _| {}, || {}).await {
                                            Ok(_) => {
                                                app_handle.restart();
                                            }
                                            Err(e) => {
                                                app_handle.dialog()
                                                    .message(format!("Failed to install update: {}", e))
                                                    .title("Update Error")
                                                    .kind(MessageDialogKind::Error)
                                                    .blocking_show();
                                            }
                                        }
                                    }
                                }
                                Ok(None) => {
                                    app_handle.dialog()
                                        .message("You are on the latest version.")
                                        .title("Check for Updates")
                                        .kind(MessageDialogKind::Info)
                                        .blocking_show();
                                }
                                Err(e) => {
                                    app_handle.dialog()
                                        .message(format!("Failed to check for updates: {}", e))
                                        .title("Update Error")
                                        .kind(MessageDialogKind::Error)
                                        .blocking_show();
                                }
                            }
                        }
                        Err(e) => {
                            app_handle.dialog()
                                .message(format!("Failed to initialize updater: {}", e))
                                .title("Update Error")
                                .kind(MessageDialogKind::Error)
                                .blocking_show();
                        }
                    }
                });
            } else if id == "exit" {
                app.exit(0);
            }
        })
        .build(app)?;

    Ok(())
}
