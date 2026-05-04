use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_store::StoreExt;

use crate::commands::util::now_iso8601;
use crate::models::terminal_scrollback::TerminalScrollback;
use crate::state::AppState;

const SCROLLBACK_CAP_BYTES: usize = 1_048_576; // 1 MiB
const READ_BUF: usize = 4096;
const PERSIST_DEBOUNCE: Duration = Duration::from_millis(2000);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TerminalRunStatus {
    Running,
    Exited,
}

pub enum TerminalCommand {
    Input(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Stop,
}

#[allow(dead_code)] // Fields are wired to live threads and consumed by later steps.
pub struct TerminalSessionHandle {
    pub conversation_id: String,
    pub agent_id: String,
    pub cwd_at_spawn: String,
    pub cols: Arc<Mutex<u16>>,
    pub rows: Arc<Mutex<u16>>,
    pub pid: Option<u32>,
    pub started_at: String,
    pub status: Arc<Mutex<TerminalRunStatus>>,
    pub input_tx: std::sync::mpsc::Sender<TerminalCommand>,
    pub scrollback: Arc<Mutex<Vec<u8>>>,
    pub killer: Arc<Mutex<Option<Box<dyn ChildKiller + Send + Sync>>>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSummary {
    pub conversation_id: String,
    pub status: TerminalRunStatus,
    pub pid: Option<u32>,
}

#[tauri::command]
pub fn terminal_spawn(
    conversation_id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    env: HashMap<String, String>,
    cols: u16,
    rows: u16,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<TerminalSummary, String> {
    {
        let terminals = state.1.lock().map_err(|e| e.to_string())?;
        if let Some(existing) = terminals.get(&conversation_id) {
            let st = *existing.status.lock().map_err(|e| e.to_string())?;
            if st == TerminalRunStatus::Running {
                return Err(format!(
                    "Terminal already running for conversation {}",
                    conversation_id
                ));
            }
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&command);
    for a in &args {
        cmd.arg(a);
    }
    cmd.cwd(&cwd);

    // Build the final env: caller-supplied vars + the MCP endpoint discovery
    // var so spawned agents can find heroi's tool surface.
    let mut env = env;
    if let Ok(data) = state.0.lock() {
        if let Some(port) = data.mcp_port {
            env.insert(
                "HEROI_MCP_URL".to_string(),
                format!("http://127.0.0.1:{}/rpc", port),
            );
        }
    }
    env.entry("HEROI_CONVERSATION_ID".to_string())
        .or_insert_with(|| conversation_id.clone());
    for (k, v) in &env {
        cmd.env(k, v);
    }

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn: {}", e))?;
    let pid = child.process_id();
    let killer = child.clone_killer();

    // Drop slave so the master sees EOF when the child exits.
    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    let scrollback: Arc<Mutex<Vec<u8>>> =
        Arc::new(Mutex::new(Vec::with_capacity(64 * 1024)));
    let status = Arc::new(Mutex::new(TerminalRunStatus::Running));
    let cols_a = Arc::new(Mutex::new(cols));
    let rows_a = Arc::new(Mutex::new(rows));
    let killer_arc: Arc<Mutex<Option<Box<dyn ChildKiller + Send + Sync>>>> =
        Arc::new(Mutex::new(Some(killer)));
    let (input_tx, input_rx) = std::sync::mpsc::channel::<TerminalCommand>();

    let started_at = now_iso8601();
    let agent_id = env
        .get("HEROI_AGENT_ID")
        .cloned()
        .unwrap_or_else(|| "shell".to_string());

    // Reader thread: PTY → ring buffer + Tauri event + debounced persist.
    {
        let scrollback = Arc::clone(&scrollback);
        let cols_a = Arc::clone(&cols_a);
        let rows_a = Arc::clone(&rows_a);
        let conv_id = conversation_id.clone();
        let agent_id_r = agent_id.clone();
        let cwd_r = cwd.clone();
        let app_r = app.clone();
        std::thread::spawn(move || {
            run_reader_loop(
                reader, scrollback, conv_id, agent_id_r, cwd_r, cols_a, rows_a, app_r,
            );
        });
    }

    // Writer/control thread owns the master PTY so it can resize it.
    {
        let conv_id = conversation_id.clone();
        let cols_a = Arc::clone(&cols_a);
        let rows_a = Arc::clone(&rows_a);
        std::thread::spawn(move || {
            run_writer_loop(pair.master, writer, input_rx, cols_a, rows_a, conv_id);
        });
    }

    // Exit watcher: flush final scrollback, mark Exited, emit exit event.
    {
        let conv_id = conversation_id.clone();
        let app_e = app.clone();
        let status_e = Arc::clone(&status);
        let scrollback_e = Arc::clone(&scrollback);
        let cols_e = Arc::clone(&cols_a);
        let rows_e = Arc::clone(&rows_a);
        let agent_id_e = agent_id.clone();
        let cwd_e = cwd.clone();
        let input_tx_e = input_tx.clone();
        std::thread::spawn(move || {
            let exit_code = child.wait().map(|s| s.exit_code() as i32).unwrap_or(1);
            if let Ok(mut st) = status_e.lock() {
                *st = TerminalRunStatus::Exited;
            }
            let _ = persist_scrollback(
                &app_e,
                &conv_id,
                &agent_id_e,
                &cwd_e,
                cols_e
                    .lock()
                    .map(|g| *g)
                    .unwrap_or(80) as u32,
                rows_e
                    .lock()
                    .map(|g| *g)
                    .unwrap_or(24) as u32,
                &scrollback_e,
            );
            let _ = app_e.emit(&format!("terminal://{}/exit", conv_id), exit_code);
            let _ = input_tx_e.send(TerminalCommand::Stop);
        });
    }

    let handle = TerminalSessionHandle {
        conversation_id: conversation_id.clone(),
        agent_id,
        cwd_at_spawn: cwd,
        cols: cols_a,
        rows: rows_a,
        pid,
        started_at,
        status: Arc::clone(&status),
        input_tx,
        scrollback,
        killer: killer_arc,
    };

    let summary = TerminalSummary {
        conversation_id: conversation_id.clone(),
        status: TerminalRunStatus::Running,
        pid,
    };

    let mut terminals = state.1.lock().map_err(|e| e.to_string())?;
    terminals.insert(conversation_id, handle);
    Ok(summary)
}

#[tauri::command]
pub fn terminal_input(
    conversation_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let terminals = state.1.lock().map_err(|e| e.to_string())?;
    let handle = terminals
        .get(&conversation_id)
        .ok_or_else(|| format!("Terminal '{}' not found", conversation_id))?;
    handle
        .input_tx
        .send(TerminalCommand::Input(data.into_bytes()))
        .map_err(|e| format!("Send failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    conversation_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let terminals = state.1.lock().map_err(|e| e.to_string())?;
    let handle = terminals
        .get(&conversation_id)
        .ok_or_else(|| format!("Terminal '{}' not found", conversation_id))?;
    handle
        .input_tx
        .send(TerminalCommand::Resize { cols, rows })
        .map_err(|e| format!("Send failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_kill(
    conversation_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let terminals = state.1.lock().map_err(|e| e.to_string())?;
    let handle = terminals
        .get(&conversation_id)
        .ok_or_else(|| format!("Terminal '{}' not found", conversation_id))?;
    if let Ok(mut g) = handle.killer.lock() {
        if let Some(k) = g.as_mut() {
            let _ = k.kill();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_load_scrollback(
    conversation_id: String,
    app: AppHandle,
) -> Result<Option<TerminalScrollback>, String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    match store.get(scrollback_key(&conversation_id)) {
        Some(val) => {
            let sb: TerminalScrollback =
                serde_json::from_value(val.clone()).map_err(|e| e.to_string())?;
            Ok(Some(sb))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn list_terminals(state: State<'_, AppState>) -> Result<Vec<TerminalSummary>, String> {
    let terminals = state.1.lock().map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(terminals.len());
    for h in terminals.values() {
        let status = h.status.lock().map(|g| *g).unwrap_or(TerminalRunStatus::Exited);
        out.push(TerminalSummary {
            conversation_id: h.conversation_id.clone(),
            status,
            pid: h.pid,
        });
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_arguments)]
fn run_reader_loop(
    mut reader: Box<dyn Read + Send>,
    scrollback: Arc<Mutex<Vec<u8>>>,
    conversation_id: String,
    agent_id: String,
    cwd: String,
    cols_a: Arc<Mutex<u16>>,
    rows_a: Arc<Mutex<u16>>,
    app: AppHandle,
) {
    let mut buf = [0u8; READ_BUF];
    let mut last_persist = Instant::now();
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                let chunk = &buf[..n];
                if let Ok(mut sb) = scrollback.lock() {
                    sb.extend_from_slice(chunk);
                    if sb.len() > SCROLLBACK_CAP_BYTES {
                        let drop_n = sb.len() - SCROLLBACK_CAP_BYTES;
                        sb.drain(0..drop_n);
                    }
                }
                let payload = String::from_utf8_lossy(chunk).to_string();
                let _ = app.emit(
                    &format!("terminal://{}/data", conversation_id),
                    payload,
                );

                if last_persist.elapsed() >= PERSIST_DEBOUNCE {
                    let cols = cols_a.lock().map(|g| *g).unwrap_or(80) as u32;
                    let rows = rows_a.lock().map(|g| *g).unwrap_or(24) as u32;
                    let _ = persist_scrollback(
                        &app,
                        &conversation_id,
                        &agent_id,
                        &cwd,
                        cols,
                        rows,
                        &scrollback,
                    );
                    last_persist = Instant::now();
                }
            }
            Err(_) => break,
        }
    }
}

fn run_writer_loop(
    master: Box<dyn MasterPty + Send>,
    mut writer: Box<dyn Write + Send>,
    rx: std::sync::mpsc::Receiver<TerminalCommand>,
    cols: Arc<Mutex<u16>>,
    rows: Arc<Mutex<u16>>,
    _conversation_id: String,
) {
    while let Ok(cmd) = rx.recv() {
        match cmd {
            TerminalCommand::Input(bytes) => {
                let _ = writer.write_all(&bytes);
                let _ = writer.flush();
            }
            TerminalCommand::Resize { cols: c, rows: r } => {
                let _ = master.resize(PtySize {
                    rows: r,
                    cols: c,
                    pixel_width: 0,
                    pixel_height: 0,
                });
                if let Ok(mut g) = cols.lock() {
                    *g = c;
                }
                if let Ok(mut g) = rows.lock() {
                    *g = r;
                }
            }
            TerminalCommand::Stop => break,
        }
    }
}

fn persist_scrollback(
    app: &AppHandle,
    conversation_id: &str,
    agent_id: &str,
    cwd: &str,
    cols: u32,
    rows: u32,
    scrollback: &Arc<Mutex<Vec<u8>>>,
) -> Result<(), String> {
    let buf_str = match scrollback.lock() {
        Ok(sb) => String::from_utf8_lossy(&sb).to_string(),
        Err(e) => return Err(e.to_string()),
    };
    let record = TerminalScrollback {
        conversation_id: conversation_id.to_string(),
        ring_buffer: buf_str,
        cols,
        rows,
        cwd_at_spawn: cwd.to_string(),
        agent_id: agent_id.to_string(),
        captured_at: now_iso8601(),
    };
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set(
        scrollback_key(conversation_id),
        serde_json::to_value(&record).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

fn scrollback_key(conversation_id: &str) -> String {
    format!("terminal_scrollback_{}", conversation_id)
}
