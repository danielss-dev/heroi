use crate::models::agent::AgentDef;

#[tauri::command]
pub fn list_agents() -> Vec<AgentDef> {
    vec![
        AgentDef {
            id: "claude".into(),
            name: "Claude Code".into(),
            command: "claude".into(),
            args: vec![],
            description: "Anthropic Claude Code CLI agent".into(),
        },
        AgentDef {
            id: "codex".into(),
            name: "Codex".into(),
            command: "codex".into(),
            args: vec![],
            description: "OpenAI Codex CLI agent".into(),
        },
        AgentDef {
            id: "gemini".into(),
            name: "Gemini CLI".into(),
            command: "gemini".into(),
            args: vec![],
            description: "Google Gemini CLI agent".into(),
        },
        AgentDef {
            id: "aider".into(),
            name: "Aider".into(),
            command: "aider".into(),
            args: vec![],
            description: "Aider AI pair programming tool".into(),
        },
        AgentDef {
            id: "shell".into(),
            name: "Shell".into(),
            command: if cfg!(windows) { "powershell.exe" } else { "bash" }.into(),
            args: vec![],
            description: "Plain terminal shell".into(),
        },
    ]
}
