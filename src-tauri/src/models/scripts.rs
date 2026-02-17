use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// The heroi.json configuration file format.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HeroiConfig {
    #[serde(default)]
    pub setup: Vec<ScriptDef>,
    #[serde(default)]
    pub run: Vec<ScriptDef>,
    #[serde(default)]
    pub archive: Vec<ScriptDef>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

/// A script definition with optional Windows overrides.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptDef {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    /// Override command on Windows (optional)
    pub command_windows: Option<String>,
    /// Override args on Windows (optional)
    pub args_windows: Option<Vec<String>>,
    /// Working directory relative to worktree root (optional)
    pub cwd: Option<String>,
}

/// Tracks a running process spawned by the scripts system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningProcess {
    pub id: String,
    pub workspace_id: String,
    pub script_name: String,
    pub pid: u32,
    pub status: ProcessStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProcessStatus {
    Running,
    Exited,
    Failed,
}
