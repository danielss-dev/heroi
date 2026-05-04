use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use serde::Deserialize;
use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::commands::ports::allocate_port_range;
use crate::commands::util::{gen_id, now_iso8601};
use crate::models::conversation::{
    Conversation, ConversationMode, ConversationStatus, ConversationWorkingDir, WorkingDirKind,
};
use crate::state::AppState;

pub(crate) const KEY_CONVERSATIONS: &str = "conversations";

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WorkingDirChoice {
    Primary,
    #[serde(rename_all = "camelCase")]
    Worktree {
        branch_name: String,
        #[serde(default)]
        base_branch: Option<String>,
    },
}

#[tauri::command]
pub fn list_conversations(
    project_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Conversation>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    let result: Vec<Conversation> = match project_id {
        Some(pid) => data
            .conversations
            .iter()
            .filter(|c| c.project_id == pid)
            .cloned()
            .collect(),
        None => data.conversations.clone(),
    };
    Ok(result)
}

#[tauri::command]
pub fn create_conversation(
    project_id: String,
    name: String,
    agent_id: String,
    working_dir_choice: WorkingDirChoice,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Conversation, String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let project = data
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .cloned()
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let port_base = allocate_port_range(&data.allocated_ports)?;

    let working_dir = match &working_dir_choice {
        WorkingDirChoice::Primary => {
            let repo = git2::Repository::open(&project.repo_path)
                .map_err(|e| format!("Failed to open repo: {}", e))?;
            let workdir = repo
                .workdir()
                .map(|p| {
                    p.to_string_lossy()
                        .trim_end_matches(['/', '\\'])
                        .to_string()
                })
                .unwrap_or_else(|| project.repo_path.clone());
            let branch = repo
                .head()
                .ok()
                .and_then(|h| h.shorthand().map(|s| s.to_string()));
            ConversationWorkingDir {
                kind: WorkingDirKind::Primary,
                path: workdir,
                branch,
                base_branch: project.default_base_branch.clone(),
                worktree_name: None,
                port_base: Some(port_base),
            }
        }
        WorkingDirChoice::Worktree {
            branch_name,
            base_branch,
        } => {
            let repo_dir = Path::new(&project.repo_path);
            let worktrees_dir = repo_dir.join(".worktrees");
            if !worktrees_dir.exists() {
                std::fs::create_dir_all(&worktrees_dir)
                    .map_err(|e| format!("Failed to create .worktrees: {}", e))?;
            }
            let wt_path = worktrees_dir.join(&name);

            let mut cmd = Command::new("git");
            cmd.current_dir(&project.repo_path);
            cmd.arg("worktree")
                .arg("add")
                .arg("-b")
                .arg(branch_name)
                .arg(wt_path.to_string_lossy().to_string());
            let bb = base_branch
                .clone()
                .unwrap_or_else(|| project.default_base_branch.clone());
            cmd.arg(&bb);

            let output = cmd
                .output()
                .map_err(|e| format!("Failed to run git: {}", e))?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("git worktree add failed: {}", stderr));
            }

            ConversationWorkingDir {
                kind: WorkingDirKind::Worktree,
                path: wt_path.to_string_lossy().to_string(),
                branch: Some(branch_name.clone()),
                base_branch: bb,
                worktree_name: Some(name.clone()),
                port_base: Some(port_base),
            }
        }
    };

    let id = gen_id();
    let mut env_vars = HashMap::new();
    env_vars.insert("HEROI_PROJECT_ID".into(), project.id.clone());
    env_vars.insert("HEROI_CONVERSATION_ID".into(), id.clone());
    env_vars.insert("HEROI_WORKSPACE_PATH".into(), working_dir.path.clone());
    env_vars.insert("HEROI_ROOT_PATH".into(), project.repo_path.clone());
    env_vars.insert("HEROI_PORT".into(), port_base.to_string());
    env_vars.insert("HEROI_NAME".into(), name.clone());
    if let Some(b) = &working_dir.branch {
        env_vars.insert("HEROI_BRANCH".into(), b.clone());
    }

    let conv = Conversation {
        id,
        project_id: project.id.clone(),
        name,
        agent_id,
        mode: ConversationMode::Chat,
        working_dir,
        env_vars,
        status: ConversationStatus::Idle,
        created_at: now_iso8601(),
        archived_at: None,
        command_var_cache: HashMap::new(),
    };

    data.allocated_ports.insert(port_base);
    data.conversations.push(conv.clone());
    let conversations = data.conversations.clone();
    drop(data);

    persist_conversations(&app, &conversations)?;
    Ok(conv)
}

#[tauri::command]
pub fn delete_conversation(
    conversation_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let conv = data
        .conversations
        .iter()
        .find(|c| c.id == conversation_id)
        .cloned()
        .ok_or_else(|| format!("Conversation '{}' not found", conversation_id))?;

    let project = data
        .projects
        .iter()
        .find(|p| p.id == conv.project_id)
        .cloned();

    if conv.working_dir.kind == WorkingDirKind::Worktree {
        if let Some(project) = project {
            let _ = Command::new("git")
                .current_dir(&project.repo_path)
                .arg("worktree")
                .arg("remove")
                .arg("--force")
                .arg(&conv.working_dir.path)
                .output();

            let _ = Command::new("git")
                .current_dir(&project.repo_path)
                .arg("worktree")
                .arg("prune")
                .output();

            if Path::new(&conv.working_dir.path).exists() {
                let _ = std::fs::remove_dir_all(&conv.working_dir.path);
            }

            if let Some(branch) = &conv.working_dir.branch {
                let _ = Command::new("git")
                    .current_dir(&project.repo_path)
                    .arg("branch")
                    .arg("-D")
                    .arg(branch)
                    .output();
            }
        }
    }

    if let Some(port) = conv.working_dir.port_base {
        data.allocated_ports.remove(&port);
    }

    data.conversations.retain(|c| c.id != conversation_id);
    let conversations = data.conversations.clone();
    drop(data);

    persist_conversations(&app, &conversations)?;
    Ok(())
}

#[tauri::command]
pub fn archive_conversation(
    conversation_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    let conv = data
        .conversations
        .iter_mut()
        .find(|c| c.id == conversation_id)
        .ok_or_else(|| format!("Conversation '{}' not found", conversation_id))?;
    conv.archived_at = Some(now_iso8601());
    let conversations = data.conversations.clone();
    drop(data);
    persist_conversations(&app, &conversations)?;
    Ok(())
}

#[tauri::command]
pub fn restore_conversation(
    conversation_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    let conv = data
        .conversations
        .iter_mut()
        .find(|c| c.id == conversation_id)
        .ok_or_else(|| format!("Conversation '{}' not found", conversation_id))?;
    conv.archived_at = None;
    let conversations = data.conversations.clone();
    drop(data);
    persist_conversations(&app, &conversations)?;
    Ok(())
}

#[tauri::command]
pub fn set_conversation_status(
    conversation_id: String,
    status: ConversationStatus,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    let conv = data
        .conversations
        .iter_mut()
        .find(|c| c.id == conversation_id)
        .ok_or_else(|| format!("Conversation '{}' not found", conversation_id))?;
    conv.status = status;
    Ok(())
}

#[tauri::command]
pub fn get_conversation_env(
    conversation_id: String,
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    let conv = data
        .conversations
        .iter()
        .find(|c| c.id == conversation_id)
        .ok_or_else(|| format!("Conversation '{}' not found", conversation_id))?;
    Ok(conv.env_vars.clone())
}

pub(crate) fn persist_conversations(
    app: &tauri::AppHandle,
    conversations: &[Conversation],
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set(
        KEY_CONVERSATIONS,
        serde_json::to_value(conversations).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_conversations(app: &tauri::AppHandle, state: &AppState) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    if let Some(val) = store.get(KEY_CONVERSATIONS) {
        let mut conversations: Vec<Conversation> =
            serde_json::from_value(val.clone()).map_err(|e| e.to_string())?;

        // No PTY survives an app restart, so reset transient runtime status
        // and re-claim the port allocations these conversations own.
        for c in conversations.iter_mut() {
            if matches!(c.status, ConversationStatus::Running) {
                c.status = ConversationStatus::Exited;
            }
        }

        let mut data = state.0.lock().map_err(|e| e.to_string())?;
        for c in &conversations {
            if let Some(port) = c.working_dir.port_base {
                data.allocated_ports.insert(port);
            }
        }
        data.conversations = conversations;
    }
    Ok(())
}
