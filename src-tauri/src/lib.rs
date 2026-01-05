// Suppress deprecation warnings for cocoa/objc crates (migration to objc2 is a larger task)
// Suppress unexpected_cfgs from objc macro (uses legacy cfg conditions)
#![allow(deprecated, unexpected_cfgs)]

mod commands;
mod database;
mod models;

use database::Database;
use tauri::Manager;

// macOS-specific imports for traffic light button repositioning
// Note: cocoa/objc crates are deprecated in favor of objc2, but still functional
#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::appkit::{NSWindow, NSWindowButton};
#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::base::id;
#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::foundation::NSRect;
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

/// Repositions macOS traffic light buttons (close, minimize, zoom)
/// to the specified x, y coordinates from the top-left of the window
#[cfg(target_os = "macos")]
#[allow(deprecated)]
unsafe fn reposition_traffic_lights(ns_window: id, x: f64, y: f64) {
    // Get the content view to calculate proper positioning
    let content_view: id = msg_send![ns_window, contentView];
    let _content_frame: NSRect = msg_send![content_view, frame];

    // Buttons: Close, Minimize, Zoom
    let buttons = [
        NSWindowButton::NSWindowCloseButton,
        NSWindowButton::NSWindowMiniaturizeButton,
        NSWindowButton::NSWindowZoomButton,
    ];

    for (i, button_type) in buttons.iter().enumerate() {
        let button: id = ns_window.standardWindowButton_(*button_type);
        if button != cocoa::base::nil {
            // Get the button's superview (the title bar container)
            let superview: id = msg_send![button, superview];
            if superview != cocoa::base::nil {
                let superview_frame: NSRect = msg_send![superview, frame];
                let button_frame: NSRect = msg_send![button, frame];

                // Calculate new position
                // X: base offset + spacing between buttons (each button ~20px apart)
                let new_x = x + (i as f64 * 20.0);
                // Y: position from top (macOS coordinate system is bottom-up)
                let new_y = superview_frame.size.height - y - button_frame.size.height;

                let new_frame = NSRect::new(
                    cocoa::foundation::NSPoint::new(new_x, new_y),
                    button_frame.size,
                );
                let _: () = msg_send![button, setFrame: new_frame];
            }
        }
    }
}

/// Sets up a window delegate to handle resize events and reposition traffic lights
#[cfg(target_os = "macos")]
#[allow(deprecated)]
unsafe fn setup_traffic_light_observer(ns_window: id, x: f64, y: f64) {
    // For now, we'll just reposition on initial setup
    // A full implementation would require creating a proper NSWindowDelegate
    // which is complex and can cause issues with Tauri's existing delegate
    reposition_traffic_lights(ns_window, x, y);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Get app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // Initialize database
            let db = Database::new(app_data_dir).expect("Failed to initialize database");

            // Create tutorial stream on first run
            db.create_tutorial_stream()
                .expect("Failed to create tutorial stream");

            // Manage database state
            app.manage(db);

            // Reposition macOS traffic light buttons
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main");
                if let Some(window) = window {
                    // Use raw window handle to get NSWindow
                    if let Ok(ns_window) = window.ns_window() {
                        unsafe {
                            // Position traffic lights at (20, 20) from top-left
                            // Similar to Obsidian's trafficLightPosition
                            setup_traffic_light_observer(ns_window as id, 20.0, 20.0);
                        }
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Profile commands
            commands::create_profile,
            commands::get_all_profiles,
            commands::get_profile,
            commands::update_profile,
            commands::delete_profile,
            commands::get_default_profile,
            commands::get_profile_entry_count,
            // Stream commands
            commands::create_stream,
            commands::get_all_streams,
            commands::get_stream_details,
            commands::delete_stream,
            commands::update_stream,
            // Entry commands
            commands::create_entry,
            commands::update_entry_content,
            commands::update_entry_profile,
            commands::bulk_update_entry_profile,
            commands::toggle_entry_staging,
            commands::delete_entry,
            commands::get_staged_entries,
            commands::clear_all_staging,
            // Version commands
            commands::commit_entry_version,
            commands::get_entry_versions,
            commands::get_latest_version,
            commands::get_version_by_number,
            commands::revert_to_version,
            // Bridge commands
            commands::generate_bridge_key,
            commands::validate_bridge_key,
            commands::extract_bridge_key,
            commands::create_pending_block,
            commands::get_pending_block,
            commands::delete_pending_block,
            // Search commands
            commands::search_entries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
