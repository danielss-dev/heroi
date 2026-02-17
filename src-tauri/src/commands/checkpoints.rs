use std::process::Command;

use tauri::State;

use crate::models::checkpoint::Checkpoint;
use crate::state::AppState;

/// Create a checkpoint (git stash-like snapshot).
#[tauri::command]
pub fn create_checkpoint(
    workspace_id: String,
    worktree_path: String,
    label: String,
    agent_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Checkpoint, String> {
    // Stage all changes
    let _ = Command::new("git")
        .current_dir(&worktree_path)
        .args(["add", "-A"])
        .output();

    // Count changed files
    let status = Command::new("git")
        .current_dir(&worktree_path)
        .args(["diff", "--cached", "--name-only"])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    let file_count = String::from_utf8_lossy(&status.stdout)
        .lines()
        .filter(|l| !l.is_empty())
        .count() as u32;

    // Create a commit as checkpoint
    let msg = format!("[checkpoint] {}", label);
    let commit = Command::new("git")
        .current_dir(&worktree_path)
        .args(["commit", "--allow-empty", "-m", &msg])
        .output()
        .map_err(|e| format!("Failed to create checkpoint commit: {}", e))?;

    if !commit.status.success() {
        let stderr = String::from_utf8_lossy(&commit.stderr);
        return Err(format!("Checkpoint commit failed: {}", stderr));
    }

    // Get the commit hash
    let rev = Command::new("git")
        .current_dir(&worktree_path)
        .args(["rev-parse", "HEAD"])
        .output()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    let git_ref = String::from_utf8_lossy(&rev.stdout).trim().to_string();

    let checkpoint = Checkpoint {
        id: format!("cp-{}", &git_ref[..8]),
        workspace_id,
        label,
        git_ref,
        created_at: crate::commands::workspace_lifecycle::now_iso8601_pub(),
        file_count,
        agent_id,
    };

    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.checkpoints.push(checkpoint.clone());

    Ok(checkpoint)
}

/// List checkpoints for a workspace.
#[tauri::command]
pub fn list_checkpoints(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Checkpoint>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    let cps: Vec<Checkpoint> = data
        .checkpoints
        .iter()
        .filter(|c| c.workspace_id == workspace_id)
        .cloned()
        .collect();
    Ok(cps)
}

/// Restore to a checkpoint (git reset).
#[tauri::command]
pub fn restore_checkpoint(
    worktree_path: String,
    git_ref: String,
) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(&worktree_path)
        .args(["reset", "--hard", &git_ref])
        .output()
        .map_err(|e| format!("Failed to restore checkpoint: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Restore failed: {}", stderr));
    }

    Ok(())
}

/// Delete a checkpoint from state.
#[tauri::command]
pub fn delete_checkpoint(
    checkpoint_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.checkpoints.retain(|c| c.id != checkpoint_id);
    Ok(())
}

/// Get diff between two checkpoints or between checkpoint and current.
#[tauri::command]
pub fn diff_checkpoint(
    worktree_path: String,
    from_ref: String,
    to_ref: Option<String>,
) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&worktree_path);
    cmd.args(["diff", &from_ref]);

    if let Some(ref to) = to_ref {
        cmd.arg(to);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to diff: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
