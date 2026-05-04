use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalScrollback {
    pub conversation_id: String,
    pub ring_buffer: String,
    pub cols: u32,
    pub rows: u32,
    pub cwd_at_spawn: String,
    pub agent_id: String,
    pub captured_at: String,
}
