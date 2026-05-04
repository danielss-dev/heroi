use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConversationMode {
    Chat,
    Kanban,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WorkingDirKind {
    Primary,
    Worktree,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConversationStatus {
    Idle,
    Running,
    Exited,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationWorkingDir {
    pub kind: WorkingDirKind,
    pub path: String,
    pub branch: Option<String>,
    pub base_branch: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub worktree_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port_base: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub agent_id: String,
    pub mode: ConversationMode,
    pub working_dir: ConversationWorkingDir,
    pub env_vars: HashMap<String, String>,
    pub status: ConversationStatus,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<String>,
    #[serde(default)]
    pub command_var_cache: HashMap<String, HashMap<String, String>>,
}
