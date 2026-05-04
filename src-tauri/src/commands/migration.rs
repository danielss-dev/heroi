use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::commands::conversations::{persist_conversations, KEY_CONVERSATIONS};
use crate::commands::projects::{persist_projects, KEY_PROJECTS};
use crate::models::conversation::Conversation;
use crate::models::project::Project;
use crate::state::AppState;

pub const HEROI_SCHEMA_VERSION: i64 = 2;
const KEY_SCHEMA_VERSION: &str = "schema_version";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationPayloadV2 {
    pub schema_version: i64,
    pub projects: Vec<Project>,
    pub conversations: Vec<Conversation>,
}

#[tauri::command]
pub fn get_schema_version(app: tauri::AppHandle) -> Result<i64, String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    let v = store
        .get(KEY_SCHEMA_VERSION)
        .and_then(|v| v.as_i64())
        .unwrap_or(1);
    Ok(v)
}

/// Persist the v2 schema (projects + conversations) and stamp the schema
/// version. Idempotent: re-running with the same payload overwrites the
/// projects/conversations arrays in place and refreshes the in-memory
/// AppData.
///
/// Legacy keys (`workspace_configs`, `workspaces`, `activeWorkspaceId`,
/// `workspace_notes_*`, `local_scripts_*`) are intentionally left untouched
/// so a rollback is possible during the foundation milestone.
#[tauri::command]
pub fn migrate_to_v2(
    payload: MigrationPayloadV2,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if payload.schema_version != HEROI_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported schemaVersion {}, expected {}",
            payload.schema_version, HEROI_SCHEMA_VERSION
        ));
    }

    persist_projects(&app, &payload.projects)?;
    persist_conversations(&app, &payload.conversations)?;

    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set(
        KEY_SCHEMA_VERSION,
        serde_json::Value::Number(HEROI_SCHEMA_VERSION.into()),
    );
    // Mirror keys the persist_* helpers already wrote so a single save() flushes everything.
    let _ = KEY_PROJECTS;
    let _ = KEY_CONVERSATIONS;
    store.save().map_err(|e| e.to_string())?;

    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    for c in &payload.conversations {
        if let Some(port) = c.working_dir.port_base {
            data.allocated_ports.insert(port);
        }
    }
    data.projects = payload.projects;
    data.conversations = payload.conversations;
    Ok(())
}
