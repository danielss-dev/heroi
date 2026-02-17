use std::collections::HashSet;
use std::sync::Mutex;

use crate::models::checkpoint::Checkpoint;
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
}

pub struct AppState(pub Mutex<AppData>);

impl AppState {
    pub fn new() -> Self {
        Self(Mutex::new(AppData::default()))
    }
}
