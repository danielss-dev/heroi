mod commands;
mod models;
mod state;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .setup(|app| {
            // Load persisted repos on startup
            let state = app.state::<AppState>();
            if let Err(e) = commands::repos::load_repos(app.handle(), state.inner()) {
                eprintln!("Failed to load repos: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::repos::add_repo,
            commands::repos::remove_repo,
            commands::repos::list_repos,
            commands::worktrees::list_worktrees,
            commands::worktrees::list_branches,
            commands::worktrees::get_default_branch,
            commands::worktrees::create_worktree,
            commands::worktrees::remove_worktree,
            commands::git::git_status,
            commands::git::git_diff,
            commands::git::git_diff_file,
            commands::git::git_stage_file,
            commands::git::git_unstage_file,
            commands::git::git_stage_all,
            commands::git::git_unstage_all,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_ahead_count,
            commands::ide::open_in_ide,
            commands::ide::open_file_in_ide,
            commands::agents::list_agents,
            commands::settings::save_settings,
            commands::settings::load_settings,
            commands::workspaces::save_workspaces,
            commands::workspaces::load_workspaces,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
