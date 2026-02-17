use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkspaceStatus {
    Active,
    Archived,
}

impl Default for WorkspaceStatus {
    fn default() -> Self {
        Self::Active
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub id: String,
    pub name: String,
    pub repo_path: String,
    pub worktree_path: String,
    pub branch: String,
    pub is_main_worktree: bool,
    pub env_vars: HashMap<String, String>,
    pub port_base: u16,
    pub status: WorkspaceStatus,
    pub created_at: String,
}
