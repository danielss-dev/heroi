mod commands;
mod models;
mod state;

use tauri::Manager;

use state::AppState;

// Several `commands::workspace_lifecycle::*` handlers are deliberately kept
// registered for the legacy orchestration engine and the v1→v2 migration
// path; suppress deprecation warnings at the registration site only.
#[allow(deprecated)]
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
            // Load persisted workspace configs on startup (legacy v1 schema, kept
            // so the migration step can read them on upgrade).
            #[allow(deprecated)]
            if let Err(e) = commands::workspace_lifecycle::load_workspace_configs(app.handle(), state.inner()) {
                eprintln!("Failed to load workspace configs: {}", e);
            }
            // Foundation v2: load projects and conversations.
            if let Err(e) = commands::projects::load_projects(app.handle(), state.inner()) {
                eprintln!("Failed to load projects: {}", e);
            }
            if let Err(e) = commands::conversations::load_conversations(app.handle(), state.inner()) {
                eprintln!("Failed to load conversations: {}", e);
            }
            if let Err(e) =
                commands::project_commands::load_project_commands(app.handle(), state.inner())
            {
                eprintln!("Failed to load project commands: {}", e);
            }
            // Foundation v2: start the MCP HTTP-JSON-RPC server.
            match commands::mcp::start_mcp_server(app.handle().clone()) {
                Ok(port) => {
                    println!("[heroi] MCP server listening on http://127.0.0.1:{}/rpc", port);
                }
                Err(e) => eprintln!("Failed to start MCP server: {}", e),
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
            commands::orchestrate::save_orchestrations,
            commands::orchestrate::load_orchestrations,
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
            commands::scripts::save_local_scripts,
            commands::scripts::load_local_scripts,
            commands::github::check_gh_available,
            commands::github::create_pr,
            commands::github::get_pr_status,
            commands::github::list_pr_checks,
            commands::github::merge_pr,
            commands::files::list_directory,
            commands::files::read_file,
            commands::files::file_exists,
            commands::files::copy_file,
            commands::files::write_binary_file,
            commands::checkpoints::create_checkpoint,
            commands::checkpoints::list_checkpoints,
            commands::checkpoints::restore_checkpoint,
            commands::checkpoints::delete_checkpoint,
            commands::checkpoints::diff_checkpoint,
            commands::migration::get_schema_version,
            commands::migration::migrate_to_v2,
            commands::projects::list_projects,
            commands::projects::add_project,
            commands::projects::rename_project,
            commands::projects::archive_project,
            commands::projects::restore_project,
            commands::projects::delete_project,
            commands::conversations::list_conversations,
            commands::conversations::create_conversation,
            commands::conversations::delete_conversation,
            commands::conversations::archive_conversation,
            commands::conversations::restore_conversation,
            commands::conversations::set_conversation_status,
            commands::conversations::get_conversation_env,
            commands::terminal::terminal_spawn,
            commands::terminal::terminal_input,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
            commands::terminal::terminal_load_scrollback,
            commands::terminal::list_terminals,
            commands::reviews::list_inline_comments,
            commands::reviews::add_inline_comment,
            commands::reviews::update_inline_comment,
            commands::reviews::delete_inline_comment,
            commands::reviews::ship_inline_comments,
            commands::reviews::mark_comment_resolved,
            commands::project_commands::list_project_commands,
            commands::project_commands::upsert_project_command,
            commands::project_commands::delete_project_command,
            commands::project_commands::run_project_command,
            commands::project_commands::list_project_var_advisory,
            commands::mcp::get_mcp_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
