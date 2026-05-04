use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct JsonRpcRequest {
    /// Accepted but not enforced — clients may send "2.0" or omit it.
    #[serde(default)]
    #[allow(dead_code)]
    pub jsonrpc: Option<String>,
    pub id: Option<serde_json::Value>,
    pub method: String,
    #[serde(default)]
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: &'static str,
    pub id: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl JsonRpcResponse {
    pub fn success(id: serde_json::Value, result: serde_json::Value) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: Some(result),
            error: None,
        }
    }

    pub fn err(id: serde_json::Value, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.into(),
                data: None,
            }),
        }
    }
}

/// Tauri events emitted by the MCP server. Frontend subscribes to
/// `heroi://mcp/event` and dispatches by `type`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum McpEvent {
    PostStatus {
        conversation_id: String,
        text: String,
        level: String,
    },
    CommentResolved {
        conversation_id: String,
        comment_id: String,
    },
}

pub const MCP_EVENT_NAME: &str = "heroi://mcp/event";
