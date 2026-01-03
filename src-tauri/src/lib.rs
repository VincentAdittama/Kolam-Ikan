mod commands;
mod database;
mod models;

use database::Database;
use tauri::Manager;

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
            db.create_tutorial_stream().expect("Failed to create tutorial stream");
            
            // Manage database state
            app.manage(db);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Stream commands
            commands::create_stream,
            commands::get_all_streams,
            commands::get_stream_details,
            commands::delete_stream,
            commands::update_stream,
            // Entry commands
            commands::create_entry,
            commands::update_entry_content,
            commands::toggle_entry_staging,
            commands::delete_entry,
            commands::get_staged_entries,
            commands::clear_all_staging,
            // Version commands
            commands::commit_entry_version,
            commands::get_entry_versions,
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

