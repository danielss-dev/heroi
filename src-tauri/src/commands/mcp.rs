use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::git;
use crate::commands::project_commands;
use crate::commands::reviews;
use crate::models::inline_comment::InlineCommentStatus;
use crate::models::mcp::{JsonRpcRequest, JsonRpcResponse, McpEvent, MCP_EVENT_NAME};
use crate::state::AppState;

const HEADER_CONV_ID: &str = "x-heroi-conversation-id";
const RPC_PATH: &str = "/rpc";

/// Bind to a free localhost port, store it on AppData.mcp_port, and spawn the
/// accept loop. Returns the chosen port.
pub fn start_mcp_server(app: AppHandle) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind MCP server: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    {
        let state = app.state::<AppState>();
        let mut data = state.0.lock().map_err(|e| e.to_string())?;
        data.mcp_port = Some(port);
    }

    let app_handle = Arc::new(app);
    thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(s) => {
                    let app_h = Arc::clone(&app_handle);
                    thread::spawn(move || {
                        if let Err(e) = handle_connection(s, &app_h) {
                            eprintln!("[heroi:mcp] connection error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    eprintln!("[heroi:mcp] accept error: {}", e);
                }
            }
        }
    });

    Ok(port)
}

#[tauri::command]
pub fn get_mcp_port(state: tauri::State<'_, AppState>) -> Result<Option<u16>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    Ok(data.mcp_port)
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

struct HttpRequest {
    method: String,
    path: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

fn read_request(stream: &TcpStream) -> std::io::Result<HttpRequest> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(15)));
    let mut reader = BufReader::new(stream);

    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Bad request line",
        ));
    }
    let method = parts[0].to_string();
    let path = parts[1].to_string();

    let mut headers = HashMap::new();
    loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line)?;
        if n == 0 || line == "\r\n" || line == "\n" {
            break;
        }
        if let Some(idx) = line.find(':') {
            let k = line[..idx].trim().to_lowercase();
            let v = line[idx + 1..].trim().to_string();
            headers.insert(k, v);
        }
    }

    let len: usize = headers
        .get("content-length")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let mut body = vec![0u8; len];
    if len > 0 {
        reader.read_exact(&mut body)?;
    }

    Ok(HttpRequest {
        method,
        path,
        headers,
        body,
    })
}

fn write_response(stream: &mut TcpStream, status: u16, body: &[u8]) -> std::io::Result<()> {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Internal Server Error",
        _ => "OK",
    };
    write!(
        stream,
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        status,
        status_text,
        body.len()
    )?;
    stream.write_all(body)?;
    stream.flush()?;
    Ok(())
}

fn handle_connection(mut stream: TcpStream, app: &AppHandle) -> std::io::Result<()> {
    let req = read_request(&stream)?;

    if req.path != RPC_PATH {
        return write_response(&mut stream, 404, br#"{"error":"not found"}"#);
    }
    if req.method != "POST" {
        return write_response(&mut stream, 405, br#"{"error":"method not allowed"}"#);
    }

    let conv_id = req.headers.get(HEADER_CONV_ID).cloned();

    let rpc: Result<JsonRpcRequest, _> = serde_json::from_slice(&req.body);
    let rpc = match rpc {
        Ok(r) => r,
        Err(e) => {
            let resp = JsonRpcResponse::err(Value::Null, -32700, format!("Parse error: {}", e));
            let body = serde_json::to_vec(&resp).unwrap_or_default();
            return write_response(&mut stream, 400, &body);
        }
    };

    let id = rpc.id.clone().unwrap_or(Value::Null);
    let response = dispatch(app, conv_id.as_deref(), &rpc, id.clone());

    let body = serde_json::to_vec(&response).unwrap_or_default();
    write_response(&mut stream, 200, &body)
}

// ---------------------------------------------------------------------------
// JSON-RPC dispatch
// ---------------------------------------------------------------------------

fn require_conv_id(conv_id: Option<&str>, id: &Value) -> Result<String, JsonRpcResponse> {
    match conv_id {
        Some(s) if !s.is_empty() => Ok(s.to_string()),
        _ => Err(JsonRpcResponse::err(
            id.clone(),
            -32602,
            "Missing X-Heroi-Conversation-Id header",
        )),
    }
}

fn dispatch(
    app: &AppHandle,
    conv_id: Option<&str>,
    rpc: &JsonRpcRequest,
    id: Value,
) -> JsonRpcResponse {
    match rpc.method.as_str() {
        "list_project_commands" => match tool_list_project_commands(app, conv_id, &id) {
            Ok(v) => JsonRpcResponse::success(id, v),
            Err(e) => e,
        },
        "run_project_command" => match tool_run_project_command(app, conv_id, &rpc.params, &id) {
            Ok(v) => JsonRpcResponse::success(id, v),
            Err(e) => e,
        },
        "get_conversation_diff" => match tool_get_conversation_diff(app, conv_id, &id) {
            Ok(v) => JsonRpcResponse::success(id, v),
            Err(e) => e,
        },
        "post_status" => match tool_post_status(app, conv_id, &rpc.params, &id) {
            Ok(v) => JsonRpcResponse::success(id, v),
            Err(e) => e,
        },
        "list_inline_comments" => match tool_list_inline_comments(app, conv_id, &id) {
            Ok(v) => JsonRpcResponse::success(id, v),
            Err(e) => e,
        },
        "mark_comment_resolved" => match tool_mark_comment_resolved(app, &rpc.params, &id) {
            Ok(v) => JsonRpcResponse::success(id, v),
            Err(e) => e,
        },
        other => JsonRpcResponse::err(id, -32601, format!("Method not found: {}", other)),
    }
}

fn project_id_for_conversation(app: &AppHandle, conv_id: &str) -> Result<String, String> {
    let state = app.state::<AppState>();
    let data = state.0.lock().map_err(|e| e.to_string())?;
    let conv = data
        .conversations
        .iter()
        .find(|c| c.id == conv_id)
        .ok_or_else(|| format!("Conversation '{}' not found", conv_id))?;
    Ok(conv.project_id.clone())
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

fn tool_list_project_commands(
    app: &AppHandle,
    conv_id: Option<&str>,
    id: &Value,
) -> Result<Value, JsonRpcResponse> {
    let conv_id = require_conv_id(conv_id, id)?;
    let project_id = project_id_for_conversation(app, &conv_id)
        .map_err(|e| JsonRpcResponse::err(id.clone(), -32603, e))?;

    let state = app.state::<AppState>();
    let list = project_commands::list_project_commands(project_id, state)
        .map_err(|e| JsonRpcResponse::err(id.clone(), -32603, e))?;
    let runnable: Vec<_> = list.into_iter().filter(|c| c.is_agent_runnable).collect();
    Ok(serde_json::to_value(runnable).unwrap_or(Value::Null))
}

fn tool_run_project_command(
    app: &AppHandle,
    conv_id: Option<&str>,
    params: &Value,
    id: &Value,
) -> Result<Value, JsonRpcResponse> {
    let conv_id = require_conv_id(conv_id, id)?;
    let command_id = params
        .get("command_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| JsonRpcResponse::err(id.clone(), -32602, "Missing 'command_id'"))?
        .to_string();
    let vars: HashMap<String, String> = params
        .get("vars")
        .and_then(|v| v.as_object())
        .map(|m| {
            m.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
        .unwrap_or_default();

    let state = app.state::<AppState>();
    let result =
        project_commands::run_project_command(conv_id, command_id, vars, app.clone(), state)
            .map_err(|e| JsonRpcResponse::err(id.clone(), -32603, e))?;
    Ok(serde_json::to_value(result).unwrap_or(Value::Null))
}

fn tool_get_conversation_diff(
    app: &AppHandle,
    conv_id: Option<&str>,
    id: &Value,
) -> Result<Value, JsonRpcResponse> {
    let conv_id = require_conv_id(conv_id, id)?;
    let (path, base_branch) = {
        let state = app.state::<AppState>();
        let data = state
            .0
            .lock()
            .map_err(|e| JsonRpcResponse::err(id.clone(), -32603, e.to_string()))?;
        let conv = data
            .conversations
            .iter()
            .find(|c| c.id == conv_id)
            .ok_or_else(|| {
                JsonRpcResponse::err(
                    id.clone(),
                    -32603,
                    format!("Conversation '{}' not found", conv_id),
                )
            })?;
        (
            conv.working_dir.path.clone(),
            conv.working_dir.base_branch.clone(),
        )
    };
    let diff = git::git_diff_base(path, base_branch)
        .map_err(|e| JsonRpcResponse::err(id.clone(), -32603, e))?;
    Ok(serde_json::to_value(diff).unwrap_or(Value::Null))
}

fn tool_post_status(
    app: &AppHandle,
    conv_id: Option<&str>,
    params: &Value,
    id: &Value,
) -> Result<Value, JsonRpcResponse> {
    let conv_id = require_conv_id(conv_id, id)?;
    let text = params
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let level = params
        .get("level")
        .and_then(|v| v.as_str())
        .unwrap_or("info")
        .to_string();
    let _ = app.emit(
        MCP_EVENT_NAME,
        McpEvent::PostStatus {
            conversation_id: conv_id,
            text,
            level,
        },
    );
    Ok(json!({}))
}

fn tool_list_inline_comments(
    app: &AppHandle,
    conv_id: Option<&str>,
    id: &Value,
) -> Result<Value, JsonRpcResponse> {
    let conv_id = require_conv_id(conv_id, id)?;
    let comments = reviews::list_inline_comments(conv_id, app.clone())
        .map_err(|e| JsonRpcResponse::err(id.clone(), -32603, e))?;
    let open: Vec<_> = comments
        .into_iter()
        .filter(|c| c.status != InlineCommentStatus::Resolved)
        .collect();
    Ok(serde_json::to_value(open).unwrap_or(Value::Null))
}

fn tool_mark_comment_resolved(
    app: &AppHandle,
    params: &Value,
    id: &Value,
) -> Result<Value, JsonRpcResponse> {
    let comment_id = params
        .get("comment_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| JsonRpcResponse::err(id.clone(), -32602, "Missing 'comment_id'"))?
        .to_string();
    let updated = reviews::mark_comment_resolved(comment_id.clone(), app.clone())
        .map_err(|e| JsonRpcResponse::err(id.clone(), -32603, e))?;
    let _ = app.emit(
        MCP_EVENT_NAME,
        McpEvent::CommentResolved {
            conversation_id: updated.conversation_id.clone(),
            comment_id: updated.id.clone(),
        },
    );
    Ok(json!({}))
}
