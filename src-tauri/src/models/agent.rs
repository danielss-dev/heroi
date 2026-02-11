use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDef {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub description: String,
}
