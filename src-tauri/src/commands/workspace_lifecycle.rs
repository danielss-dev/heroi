//! DEPRECATED — superseded by `commands::projects` + `commands::conversations`
//! in foundation v2 (schema_version = 2). The functions in this module remain
//! registered so the legacy orchestration engine and one-time migration paths
//! keep working; they will be removed in milestone 2 once the new model has
//! soaked in real use. Do not call from new code.
#![allow(deprecated)]

use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::commands::ports::allocate_port_range;
use crate::commands::util::{gen_id, now_iso8601};
use crate::models::workspace::{WorkspaceConfig, WorkspaceStatus};
use crate::state::AppState;


#[tauri::command]
#[deprecated(note = "use commands::conversations::create_conversation")]
pub fn create_workspace(
    repo_path: String,
    name: String,
    branch: Option<String>,
    base_branch: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<WorkspaceConfig, String> {
    let repo_dir = Path::new(&repo_path);
    if !repo_dir.exists() {
        return Err("Repository path does not exist".into());
    }

    // Validate it's a git repo
    git2::Repository::open(&repo_path)
        .map_err(|e| format!("Not a valid git repository: {}", e))?;

    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    // Allocate a port range
    let port_base = allocate_port_range(&data.allocated_ports)?;

    // Create the worktree
    let new_branch = branch.unwrap_or_else(|| name.clone());
    let worktrees_dir = repo_dir.join(".worktrees");
    if !worktrees_dir.exists() {
        std::fs::create_dir_all(&worktrees_dir)
            .map_err(|e| format!("Failed to create .worktrees directory: {}", e))?;
    }
    let wt_path = worktrees_dir.join(&name);

    let mut cmd = Command::new("git");
    cmd.current_dir(&repo_path);
    cmd.arg("worktree")
        .arg("add")
        .arg("-b")
        .arg(&new_branch)
        .arg(wt_path.to_string_lossy().to_string());

    if let Some(ref base) = base_branch {
        cmd.arg(base);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree add failed: {}", stderr));
    }

    let worktree_path = wt_path.to_string_lossy().to_string();

    // Build env vars
    let mut env_vars = HashMap::new();
    env_vars.insert("HEROI_WORKSPACE_PATH".to_string(), worktree_path.clone());
    env_vars.insert("HEROI_ROOT_PATH".to_string(), repo_path.clone());
    env_vars.insert("HEROI_PORT".to_string(), port_base.to_string());
    env_vars.insert("HEROI_WORKSPACE_NAME".to_string(), name.clone());

    let workspace = WorkspaceConfig {
        id: gen_id(),
        name,
        repo_path,
        worktree_path,
        branch: new_branch,
        is_main_worktree: false,
        env_vars,
        port_base,
        status: WorkspaceStatus::Active,
        created_at: now_iso8601(),
        base_branch,
    };

    data.workspaces.push(workspace.clone());
    data.allocated_ports.insert(port_base);

    let workspaces = data.workspaces.clone();
    drop(data);

    persist_workspaces(&app, &workspaces)?;

    Ok(workspace)
}

#[tauri::command]
#[deprecated(note = "use commands::conversations::create_conversation with kind=primary")]
pub fn create_workspace_for_main(
    repo_path: String,
    name: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<WorkspaceConfig, String> {
    let repo = git2::Repository::open(&repo_path)
        .map_err(|e| format!("Not a valid git repository: {}", e))?;

    let main_path = repo
        .workdir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| repo_path.clone());

    let main_path_clean = main_path
        .trim_end_matches('/')
        .trim_end_matches('\\')
        .to_string();

    let branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "main".to_string());

    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let port_base = allocate_port_range(&data.allocated_ports)?;

    let mut env_vars = HashMap::new();
    env_vars.insert(
        "HEROI_WORKSPACE_PATH".to_string(),
        main_path_clean.clone(),
    );
    env_vars.insert("HEROI_ROOT_PATH".to_string(), repo_path.clone());
    env_vars.insert("HEROI_PORT".to_string(), port_base.to_string());
    env_vars.insert("HEROI_WORKSPACE_NAME".to_string(), name.clone());

    let workspace = WorkspaceConfig {
        id: gen_id(),
        name,
        repo_path,
        worktree_path: main_path_clean,
        branch,
        is_main_worktree: true,
        env_vars,
        port_base,
        status: WorkspaceStatus::Active,
        created_at: now_iso8601(),
        base_branch: None,
    };

    data.workspaces.push(workspace.clone());
    data.allocated_ports.insert(port_base);

    let workspaces = data.workspaces.clone();
    drop(data);

    persist_workspaces(&app, &workspaces)?;

    Ok(workspace)
}

#[tauri::command]
#[deprecated(note = "use commands::conversations::delete_conversation")]
pub fn delete_workspace(
    workspace_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let workspace = data
        .workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .cloned()
        .ok_or_else(|| format!("Workspace '{}' not found", workspace_id))?;

    // Remove the worktree if it's not the main one
    if !workspace.is_main_worktree {
        let wt_dir = Path::new(&workspace.worktree_path);

        let output = Command::new("git")
            .current_dir(&workspace.repo_path)
            .arg("worktree")
            .arg("remove")
            .arg("--force")
            .arg(&workspace.worktree_path)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if !output.status.success() {
            // Fallback: prune and remove manually
            let _ = Command::new("git")
                .current_dir(&workspace.repo_path)
                .arg("worktree")
                .arg("prune")
                .output();

            if wt_dir.exists() {
                std::fs::remove_dir_all(wt_dir)
                    .map_err(|e| format!("Failed to remove worktree directory: {}", e))?;
            }

            let _ = Command::new("git")
                .current_dir(&workspace.repo_path)
                .arg("worktree")
                .arg("prune")
                .output();
        }

        if Path::new(&workspace.worktree_path).exists() {
            std::fs::remove_dir_all(&workspace.worktree_path)
                .map_err(|e| format!("Failed to remove worktree directory: {}", e))?;
        }

        // Optionally delete the branch
        let _ = Command::new("git")
            .current_dir(&workspace.repo_path)
            .arg("branch")
            .arg("-D")
            .arg(&workspace.branch)
            .output();
    }

    // Remove port allocation
    data.allocated_ports.remove(&workspace.port_base);

    // Remove workspace from list
    data.workspaces.retain(|w| w.id != workspace_id);

    let workspaces = data.workspaces.clone();
    drop(data);

    persist_workspaces(&app, &workspaces)?;

    Ok(())
}

#[tauri::command]
#[deprecated(note = "use commands::conversations::get_conversation_env")]
pub fn get_workspace_env(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;

    let workspace = data
        .workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| format!("Workspace '{}' not found", workspace_id))?;

    Ok(workspace.env_vars.clone())
}

#[tauri::command]
#[deprecated(note = "kept solely so the v1→v2 migration can read legacy workspace_configs")]
pub fn list_workspace_configs(
    state: State<'_, AppState>,
) -> Result<Vec<WorkspaceConfig>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    Ok(data.workspaces.clone())
}

#[tauri::command]
#[deprecated(note = "use commands::conversations::archive_conversation")]
pub fn archive_workspace(
    workspace_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let workspace = data
        .workspaces
        .iter_mut()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| format!("Workspace '{}' not found", workspace_id))?;

    workspace.status = WorkspaceStatus::Archived;

    let workspaces = data.workspaces.clone();
    drop(data);

    persist_workspaces(&app, &workspaces)?;
    Ok(())
}

#[tauri::command]
#[deprecated(note = "use commands::conversations::restore_conversation")]
pub fn restore_workspace(
    workspace_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let workspace = data
        .workspaces
        .iter_mut()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| format!("Workspace '{}' not found", workspace_id))?;

    workspace.status = WorkspaceStatus::Active;

    let workspaces = data.workspaces.clone();
    drop(data);

    persist_workspaces(&app, &workspaces)?;
    Ok(())
}

#[tauri::command]
pub fn save_workspace_notes(
    workspace_id: String,
    notes: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let store = app
        .store("heroi-store.json")
        .map_err(|e| e.to_string())?;
    store.set(
        &format!("workspace_notes_{}", workspace_id),
        serde_json::Value::String(notes),
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_workspace_notes(
    workspace_id: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let store = app
        .store("heroi-store.json")
        .map_err(|e| e.to_string())?;
    let notes = store
        .get(&format!("workspace_notes_{}", workspace_id))
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    Ok(notes)
}

fn persist_workspaces(
    app: &tauri::AppHandle,
    workspaces: &[WorkspaceConfig],
) -> Result<(), String> {
    let store = app
        .store("heroi-store.json")
        .map_err(|e| e.to_string())?;
    store.set(
        "workspace_configs",
        serde_json::to_value(workspaces).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[deprecated(note = "kept for v1→v2 migration; new code should use commands::conversations")]
pub fn load_workspace_configs(
    app: &tauri::AppHandle,
    state: &AppState,
) -> Result<(), String> {
    let store = app
        .store("heroi-store.json")
        .map_err(|e| e.to_string())?;
    if let Some(val) = store.get("workspace_configs") {
        let workspaces: Vec<WorkspaceConfig> =
            serde_json::from_value(val.clone()).map_err(|e| e.to_string())?;
        let mut data = state.0.lock().map_err(|e| e.to_string())?;
        for w in &workspaces {
            data.allocated_ports.insert(w.port_base);
        }
        data.workspaces = workspaces;
    }
    Ok(())
}

