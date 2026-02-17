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
            // Load persisted workspace configs on startup
            if let Err(e) = commands::workspace_lifecycle::load_workspace_configs(app.handle(), state.inner()) {
                eprintln!("Failed to load workspace configs: {}", e);
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
            commands::git::git_diff_all,
            commands::git::git_diff_base,
            commands::git::git_file_content,
            commands::ide::open_in_ide,
            commands::ide::open_file_in_ide,
            commands::agents::list_agents,
            commands::settings::save_settings,
            commands::settings::load_settings,
            commands::workspaces::save_workspaces,
            commands::workspaces::load_workspaces,
            commands::workspace_lifecycle::create_workspace,
            commands::workspace_lifecycle::create_workspace_for_main,
            commands::workspace_lifecycle::delete_workspace,
            commands::workspace_lifecycle::get_workspace_env,
            commands::workspace_lifecycle::list_workspace_configs,
            commands::workspace_lifecycle::archive_workspace,
            commands::workspace_lifecycle::restore_workspace,
            commands::workspace_lifecycle::save_workspace_notes,
            commands::workspace_lifecycle::load_workspace_notes,
            commands::scripts::load_heroi_config,
            commands::scripts::save_heroi_config,
            commands::scripts::run_script,
            commands::scripts::stop_process,
            commands::scripts::list_running_processes,
            commands::scripts::cleanup_processes,
            commands::github::check_gh_available,
            commands::github::create_pr,
            commands::github::get_pr_status,
            commands::github::list_pr_checks,
            commands::github::merge_pr,
            commands::files::list_directory,
            commands::files::read_file,
            commands::files::file_exists,
            commands::checkpoints::create_checkpoint,
            commands::checkpoints::list_checkpoints,
            commands::checkpoints::restore_checkpoint,
            commands::checkpoints::delete_checkpoint,
            commands::checkpoints::diff_checkpoint,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
