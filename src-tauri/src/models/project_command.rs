use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CommandVariableScope {
    Conversation,
    Project,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandVariable {
    pub name: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    pub scope: CommandVariableScope,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCommand {
    pub id: String,
    pub project_id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub shell_template: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd_relative: Option<String>,
    #[serde(default)]
    pub variables: Vec<CommandVariable>,
    pub is_agent_runnable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectVariableAdvisoryEntry {
    pub variable_name: String,
    pub last_value: String,
    pub last_used_at: String,
    #[serde(default)]
    pub in_use_by_conversation_ids: Vec<String>,
}
