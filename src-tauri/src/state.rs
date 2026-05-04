use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use crate::commands::terminal::TerminalSessionHandle;
use crate::models::checkpoint::Checkpoint;
use crate::models::conversation::Conversation;
use crate::models::project::Project;
use crate::models::project_command::{ProjectCommand, ProjectVariableAdvisoryEntry};
use crate::models::repo::RepoEntry;
use crate::models::scripts::RunningProcess;
use crate::models::workspace::WorkspaceConfig;

#[derive(Default)]
pub struct AppData {
    pub repos: Vec<RepoEntry>,
    pub workspaces: Vec<WorkspaceConfig>,
    pub allocated_ports: HashSet<u16>,
    pub running_processes: Vec<RunningProcess>,
    pub checkpoints: Vec<Checkpoint>,
    pub projects: Vec<Project>,
    pub conversations: Vec<Conversation>,
    pub project_commands: Vec<ProjectCommand>,
    /// Project-wide advisory cache, keyed by project id. Each value is a list of
    /// `(variableName, lastValue)` records with the conversations currently using them.
    pub project_var_advisory: HashMap<String, Vec<ProjectVariableAdvisoryEntry>>,
    /// Port the MCP HTTP-JSON-RPC server is bound to, set after start_mcp_server.
    pub mcp_port: Option<u16>,
}

/// Lookup of live PTY sessions keyed by conversation id. Held outside
/// `AppData` so a single keystroke (terminal_input) doesn't contend with
/// every other backend lock holder.
pub type TerminalRegistry = Mutex<HashMap<String, TerminalSessionHandle>>;

pub struct AppState(pub Mutex<AppData>, pub TerminalRegistry);

impl AppState {
    pub fn new() -> Self {
        Self(Mutex::new(AppData::default()), Mutex::new(HashMap::new()))
    }
}
