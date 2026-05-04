use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::commands::terminal::{TerminalCommand, TerminalRunStatus};
use crate::commands::util::{gen_id, now_iso8601};
use crate::models::conversation::Conversation;
use crate::models::project_command::{ProjectCommand, ProjectVariableAdvisoryEntry};
use crate::state::AppState;

pub(crate) const KEY_PROJECT_COMMANDS: &str = "project_commands";
pub(crate) const KEY_PROJECT_VAR_ADVISORY: &str = "project_var_advisory";

#[tauri::command]
pub fn list_project_commands(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ProjectCommand>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    Ok(data
        .project_commands
        .iter()
        .filter(|c| c.project_id == project_id)
        .cloned()
        .collect())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertProjectCommandInput {
    /// Optional. When None or empty, a new id is generated.
    #[serde(default)]
    pub id: Option<String>,
    pub project_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub shell_template: String,
    #[serde(default)]
    pub cwd_relative: Option<String>,
    #[serde(default)]
    pub variables: Vec<crate::models::project_command::CommandVariable>,
    pub is_agent_runnable: bool,
}

#[tauri::command]
pub fn upsert_project_command(
    input: UpsertProjectCommandInput,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ProjectCommand, String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let id = input
        .id
        .as_ref()
        .filter(|s| !s.is_empty())
        .cloned()
        .unwrap_or_else(gen_id);

    let cmd = ProjectCommand {
        id: id.clone(),
        project_id: input.project_id,
        name: input.name,
        description: input.description,
        shell_template: input.shell_template,
        cwd_relative: input.cwd_relative,
        variables: input.variables,
        is_agent_runnable: input.is_agent_runnable,
    };

    if let Some(existing) = data.project_commands.iter_mut().find(|c| c.id == id) {
        *existing = cmd.clone();
    } else {
        data.project_commands.push(cmd.clone());
    }
    let snapshot = data.project_commands.clone();
    drop(data);

    persist_project_commands(&app, &snapshot)?;
    Ok(cmd)
}

#[tauri::command]
pub fn delete_project_command(
    command_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.project_commands.retain(|c| c.id != command_id);
    let snapshot = data.project_commands.clone();
    drop(data);
    persist_project_commands(&app, &snapshot)?;
    Ok(())
}

#[tauri::command]
pub fn list_project_var_advisory(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ProjectVariableAdvisoryEntry>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    Ok(data
        .project_var_advisory
        .get(&project_id)
        .cloned()
        .unwrap_or_default())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunProjectCommandResult {
    pub run_id: String,
    /// The fully resolved command line as written to the conversation's PTY.
    pub command_text: String,
}

#[tauri::command]
pub fn run_project_command(
    conversation_id: String,
    command_id: String,
    resolved_vars: HashMap<String, String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<RunProjectCommandResult, String> {
    // -------------------------------------------------------------------
    // 1. Resolve command + conversation, build the substituted command line.
    // -------------------------------------------------------------------
    let (cmd, conv) = {
        let data = state.0.lock().map_err(|e| e.to_string())?;
        let cmd = data
            .project_commands
            .iter()
            .find(|c| c.id == command_id)
            .cloned()
            .ok_or_else(|| format!("Command '{}' not found", command_id))?;
        let conv = data
            .conversations
            .iter()
            .find(|c| c.id == conversation_id)
            .cloned()
            .ok_or_else(|| format!("Conversation '{}' not found", conversation_id))?;
        if cmd.project_id != conv.project_id {
            return Err("Command does not belong to this conversation's project".into());
        }
        (cmd, conv)
    };

    let substituted = substitute_vars(&cmd.shell_template, &resolved_vars);
    let command_text = match cmd.cwd_relative.as_deref() {
        Some(rel) if !rel.is_empty() => {
            format!("(cd {} && {})", shell_quote(rel), substituted)
        }
        _ => substituted,
    };

    // -------------------------------------------------------------------
    // 2. Deliver to the conversation's live PTY.
    // -------------------------------------------------------------------
    {
        let terminals = state.1.lock().map_err(|e| e.to_string())?;
        let handle = terminals.get(&conversation_id).ok_or_else(|| {
            "No live agent session for this conversation. Restart the agent first.".to_string()
        })?;
        let st = *handle.status.lock().map_err(|e| e.to_string())?;
        if st != TerminalRunStatus::Running {
            return Err("Agent has exited. Restart it before running commands.".into());
        }
        let line = format!("{}\n", command_text);
        handle
            .input_tx
            .send(TerminalCommand::Input(line.into_bytes()))
            .map_err(|e| format!("Failed to deliver command: {}", e))?;
    }

    // -------------------------------------------------------------------
    // 3. Update per-conversation cache + project advisory cache.
    // -------------------------------------------------------------------
    {
        let mut data = state.0.lock().map_err(|e| e.to_string())?;

        if let Some(c) = data
            .conversations
            .iter_mut()
            .find(|c| c.id == conversation_id)
        {
            c.command_var_cache
                .insert(command_id.clone(), resolved_vars.clone());
        }

        let advisory = data
            .project_var_advisory
            .entry(conv.project_id.clone())
            .or_default();
        update_advisory(advisory, &resolved_vars, &conversation_id);

        let advisory_snapshot = data.project_var_advisory.clone();
        let conversations_snapshot: Vec<Conversation> = data.conversations.clone();
        drop(data);

        persist_advisory(&app, &advisory_snapshot)?;
        crate::commands::conversations::persist_conversations(&app, &conversations_snapshot)?;
    }

    Ok(RunProjectCommandResult {
        run_id: gen_id(),
        command_text,
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn substitute_vars(template: &str, vars: &HashMap<String, String>) -> String {
    let mut out = String::with_capacity(template.len());
    let mut remaining = template;
    while !remaining.is_empty() {
        match remaining.find("${{") {
            None => {
                out.push_str(remaining);
                break;
            }
            Some(start) => {
                out.push_str(&remaining[..start]);
                let after_open = &remaining[start + 3..];
                match after_open.find("}}") {
                    None => {
                        // Unterminated placeholder — emit as literal so the user sees the issue.
                        out.push_str(&remaining[start..]);
                        break;
                    }
                    Some(end_rel) => {
                        let name = after_open[..end_rel].trim();
                        let value = vars.get(name).map(|s| s.as_str()).unwrap_or("");
                        out.push_str(value);
                        remaining = &after_open[end_rel + 2..];
                    }
                }
            }
        }
    }
    out
}

fn shell_quote(s: &str) -> String {
    if s.is_empty() {
        return "''".into();
    }
    if s.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '/' || c == '.')
    {
        return s.into();
    }
    let mut out = String::from("\"");
    for c in s.chars() {
        if c == '"' || c == '\\' || c == '$' || c == '`' {
            out.push('\\');
        }
        out.push(c);
    }
    out.push('"');
    out
}

fn update_advisory(
    advisory: &mut Vec<ProjectVariableAdvisoryEntry>,
    resolved: &HashMap<String, String>,
    conversation_id: &str,
) {
    let now = now_iso8601();
    for (name, value) in resolved {
        // Step 1 — drop this conversation from any other (name, *) entries.
        for entry in advisory.iter_mut() {
            if entry.variable_name == *name && entry.last_value != *value {
                entry
                    .in_use_by_conversation_ids
                    .retain(|id| id != conversation_id);
            }
        }
        advisory.retain(|e| {
            e.variable_name != *name
                || !e.in_use_by_conversation_ids.is_empty()
                || e.last_value == *value
        });

        // Step 2 — upsert the (name, value) entry with this conversation listed.
        if let Some(entry) = advisory
            .iter_mut()
            .find(|e| e.variable_name == *name && e.last_value == *value)
        {
            if !entry.in_use_by_conversation_ids.contains(&conversation_id.to_string()) {
                entry
                    .in_use_by_conversation_ids
                    .push(conversation_id.to_string());
            }
            entry.last_used_at = now.clone();
        } else {
            advisory.push(ProjectVariableAdvisoryEntry {
                variable_name: name.clone(),
                last_value: value.clone(),
                last_used_at: now.clone(),
                in_use_by_conversation_ids: vec![conversation_id.to_string()],
            });
        }
    }
}

pub(crate) fn persist_project_commands(
    app: &tauri::AppHandle,
    commands: &[ProjectCommand],
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set(
        KEY_PROJECT_COMMANDS,
        serde_json::to_value(commands).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn persist_advisory(
    app: &tauri::AppHandle,
    advisory: &HashMap<String, Vec<ProjectVariableAdvisoryEntry>>,
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set(
        KEY_PROJECT_VAR_ADVISORY,
        serde_json::to_value(advisory).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_project_commands(
    app: &tauri::AppHandle,
    state: &AppState,
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    if let Some(val) = store.get(KEY_PROJECT_COMMANDS) {
        let commands: Vec<ProjectCommand> =
            serde_json::from_value(val.clone()).map_err(|e| e.to_string())?;
        let mut data = state.0.lock().map_err(|e| e.to_string())?;
        data.project_commands = commands;
    }
    if let Some(val) = store.get(KEY_PROJECT_VAR_ADVISORY) {
        let advisory: HashMap<String, Vec<ProjectVariableAdvisoryEntry>> =
            serde_json::from_value(val.clone()).map_err(|e| e.to_string())?;
        let mut data = state.0.lock().map_err(|e| e.to_string())?;
        data.project_var_advisory = advisory;
    }
    Ok(())
}
