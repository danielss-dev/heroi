use serde::Deserialize;
use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::commands::terminal::{TerminalCommand, TerminalRunStatus};
use crate::commands::util::{gen_id, now_iso8601};
use crate::models::inline_comment::{InlineComment, InlineCommentSide, InlineCommentStatus};
use crate::state::AppState;

fn comments_key(conversation_id: &str) -> String {
    format!("inline_comments_{}", conversation_id)
}

fn read_comments(
    app: &tauri::AppHandle,
    conversation_id: &str,
) -> Result<Vec<InlineComment>, String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    match store.get(comments_key(conversation_id)) {
        Some(val) => serde_json::from_value(val.clone()).map_err(|e| e.to_string()),
        None => Ok(Vec::new()),
    }
}

fn write_comments(
    app: &tauri::AppHandle,
    conversation_id: &str,
    comments: &[InlineComment],
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set(
        comments_key(conversation_id),
        serde_json::to_value(comments).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

fn find_conversation_id_for_comment(
    app: &tauri::AppHandle,
    comment_id: &str,
) -> Result<(String, Vec<InlineComment>), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    for key in store.keys() {
        if let Some(rest) = key.strip_prefix("inline_comments_") {
            if let Some(val) = store.get(&key) {
                let list: Vec<InlineComment> =
                    serde_json::from_value(val.clone()).map_err(|e| e.to_string())?;
                if list.iter().any(|c| c.id == comment_id) {
                    return Ok((rest.to_string(), list));
                }
            }
        }
    }
    Err(format!("Comment '{}' not found", comment_id))
}

#[tauri::command]
pub fn list_inline_comments(
    conversation_id: String,
    app: tauri::AppHandle,
) -> Result<Vec<InlineComment>, String> {
    read_comments(&app, &conversation_id)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InlineCommentDraftInput {
    pub conversation_id: String,
    pub file_path: String,
    pub side: InlineCommentSide,
    pub line_number: u32,
    pub body: String,
}

#[tauri::command]
pub fn add_inline_comment(
    draft: InlineCommentDraftInput,
    app: tauri::AppHandle,
) -> Result<InlineComment, String> {
    let mut list = read_comments(&app, &draft.conversation_id)?;

    let comment = InlineComment {
        id: gen_id(),
        conversation_id: draft.conversation_id.clone(),
        file_path: draft.file_path,
        side: draft.side,
        line_number: draft.line_number,
        body: draft.body,
        status: InlineCommentStatus::Draft,
        created_at: now_iso8601(),
        shipped_at: None,
        resolved_at: None,
    };

    list.push(comment.clone());
    write_comments(&app, &draft.conversation_id, &list)?;
    Ok(comment)
}

#[tauri::command]
pub fn update_inline_comment(
    comment_id: String,
    body: String,
    app: tauri::AppHandle,
) -> Result<InlineComment, String> {
    let (conv_id, mut list) = find_conversation_id_for_comment(&app, &comment_id)?;
    let comment = list
        .iter_mut()
        .find(|c| c.id == comment_id)
        .ok_or_else(|| format!("Comment '{}' not found", comment_id))?;
    if comment.status != InlineCommentStatus::Draft {
        return Err("Only draft comments can be edited".into());
    }
    comment.body = body;
    let updated = comment.clone();
    write_comments(&app, &conv_id, &list)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_inline_comment(
    comment_id: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let (conv_id, list) = find_conversation_id_for_comment(&app, &comment_id)?;
    let next: Vec<InlineComment> = list.into_iter().filter(|c| c.id != comment_id).collect();
    write_comments(&app, &conv_id, &next)?;
    Ok(())
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeliveryMode {
    Structured,
    Synthesized,
}

fn side_label(side: InlineCommentSide) -> &'static str {
    match side {
        InlineCommentSide::Old => "old",
        InlineCommentSide::New => "new",
    }
}

fn synthesized_prompt(comments: &[InlineComment]) -> String {
    let mut out = String::from("Please address the following review comments:\n");
    for c in comments {
        out.push_str(&format!(
            "- [{}:{} ({})] {}\n",
            c.file_path,
            c.line_number,
            side_label(c.side),
            c.body.trim()
        ));
    }
    out.push('\n');
    out
}

/// Structured-mode placeholder until the MCP transport lands in Step 8.
/// Writes a JSON-fenced block that downstream tooling can parse, plus a
/// human-readable lead-in so the agent has context if it ignores the fence.
fn structured_stub_prompt(conversation_id: &str, comments: &[InlineComment]) -> String {
    let payload = serde_json::json!({
        "type": "heroi/inline_comments/incoming",
        "conversationId": conversation_id,
        "comments": comments,
    });
    let pretty =
        serde_json::to_string_pretty(&payload).unwrap_or_else(|_| String::from("{}"));
    let mut out =
        String::from("[heroi] inline review comments — please address each item:\n");
    out.push_str("```json\n");
    out.push_str(&pretty);
    out.push_str("\n```\n");
    out
}

#[tauri::command]
pub fn ship_inline_comments(
    conversation_id: String,
    delivery_mode: DeliveryMode,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<InlineComment>, String> {
    let mut list = read_comments(&app, &conversation_id)?;
    let drafts: Vec<InlineComment> = list
        .iter()
        .filter(|c| c.status == InlineCommentStatus::Draft)
        .cloned()
        .collect();
    if drafts.is_empty() {
        return Ok(Vec::new());
    }

    let prompt = match delivery_mode {
        DeliveryMode::Synthesized => synthesized_prompt(&drafts),
        DeliveryMode::Structured => structured_stub_prompt(&conversation_id, &drafts),
    };

    {
        let terminals = state.1.lock().map_err(|e| e.to_string())?;
        let handle = terminals.get(&conversation_id).ok_or_else(|| {
            "No live agent session for this conversation. Restart the agent first."
                .to_string()
        })?;
        let st = *handle
            .status
            .lock()
            .map_err(|e| e.to_string())?;
        if st != TerminalRunStatus::Running {
            return Err(
                "Agent has exited. Restart it before sending comments.".into(),
            );
        }
        handle
            .input_tx
            .send(TerminalCommand::Input(prompt.into_bytes()))
            .map_err(|e| format!("Failed to deliver comments to agent: {}", e))?;
    }

    let now = now_iso8601();
    let mut shipped: Vec<InlineComment> = Vec::new();
    for c in list.iter_mut() {
        if c.status == InlineCommentStatus::Draft {
            c.status = InlineCommentStatus::Shipped;
            c.shipped_at = Some(now.clone());
            shipped.push(c.clone());
        }
    }
    write_comments(&app, &conversation_id, &list)?;
    Ok(shipped)
}

#[tauri::command]
pub fn mark_comment_resolved(
    comment_id: String,
    app: tauri::AppHandle,
) -> Result<InlineComment, String> {
    let (conv_id, mut list) = find_conversation_id_for_comment(&app, &comment_id)?;
    let now = now_iso8601();
    let comment = list
        .iter_mut()
        .find(|c| c.id == comment_id)
        .ok_or_else(|| format!("Comment '{}' not found", comment_id))?;
    comment.status = InlineCommentStatus::Resolved;
    comment.resolved_at = Some(now);
    let updated = comment.clone();
    write_comments(&app, &conv_id, &list)?;
    Ok(updated)
}
