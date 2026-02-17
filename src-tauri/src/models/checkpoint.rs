use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub workspace_id: String,
    pub label: String,
    pub git_ref: String,
    pub created_at: String,
    pub file_count: u32,
    pub agent_id: Option<String>,
}
