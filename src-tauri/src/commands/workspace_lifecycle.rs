use std::collections::HashMap;
use std::net::TcpListener;
use std::path::Path;
use std::process::Command;

use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::models::workspace::{WorkspaceConfig, WorkspaceStatus};
use crate::state::AppState;

const PORT_RANGE_SIZE: u16 = 10;
const PORT_START: u16 = 3000;
const PORT_MAX: u16 = 65000;

#[tauri::command]
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
        id: uuid_v4(),
        name,
        repo_path,
        worktree_path,
        branch: new_branch,
        is_main_worktree: false,
        env_vars,
        port_base,
        status: WorkspaceStatus::Active,
        created_at: now_iso8601(),
    };

    data.workspaces.push(workspace.clone());
    data.allocated_ports.insert(port_base);

    let workspaces = data.workspaces.clone();
    drop(data);

    persist_workspaces(&app, &workspaces)?;

    Ok(workspace)
}

#[tauri::command]
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
        id: uuid_v4(),
        name,
        repo_path,
        worktree_path: main_path_clean,
        branch,
        is_main_worktree: true,
        env_vars,
        port_base,
        status: WorkspaceStatus::Active,
        created_at: now_iso8601(),
    };

    data.workspaces.push(workspace.clone());
    data.allocated_ports.insert(port_base);

    let workspaces = data.workspaces.clone();
    drop(data);

    persist_workspaces(&app, &workspaces)?;

    Ok(workspace)
}

#[tauri::command]
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
pub fn list_workspace_configs(
    state: State<'_, AppState>,
) -> Result<Vec<WorkspaceConfig>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    Ok(data.workspaces.clone())
}

#[tauri::command]
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

fn allocate_port_range(
    allocated: &std::collections::HashSet<u16>,
) -> Result<u16, String> {
    let mut port = PORT_START;
    while port < PORT_MAX {
        if !allocated.contains(&port) && is_port_range_available(port) {
            return Ok(port);
        }
        port += PORT_RANGE_SIZE;
    }
    Err("No available port range found".into())
}

fn is_port_range_available(base: u16) -> bool {
    // Just check the base port — checking all 10 would be slow
    TcpListener::bind(("127.0.0.1", base)).is_ok()
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

fn uuid_v4() -> String {
    // Simple UUID v4 using random bytes
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let seed = now.as_nanos();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (seed & 0xFFFF_FFFF) as u32,
        ((seed >> 32) & 0xFFFF) as u16,
        ((seed >> 48) & 0x0FFF) as u16,
        (((seed >> 60) & 0x3F) | 0x80) as u16 | (((seed >> 66) & 0xFF) as u16) << 8,
        (seed >> 74) & 0xFFFF_FFFF_FFFF,
    )
}

pub fn now_iso8601_pub() -> String {
    now_iso8601()
}

fn now_iso8601() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    // Simple ISO 8601 without external deps
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Approximate date calculation (good enough for display)
    let mut y = 1970i64;
    let mut remaining_days = days as i64;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }
    let months_days: Vec<i64> = if is_leap(y) {
        vec![31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        vec![31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut m = 1;
    for md in &months_days {
        if remaining_days < *md {
            break;
        }
        remaining_days -= md;
        m += 1;
    }
    let d = remaining_days + 1;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hours, minutes, seconds
    )
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
