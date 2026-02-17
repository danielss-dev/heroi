use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use tauri::State;

use crate::models::scripts::{HeroiConfig, ProcessStatus, RunningProcess, ScriptDef};
use crate::state::AppState;

/// Load heroi.json from a workspace's worktree path.
#[tauri::command]
pub fn load_heroi_config(worktree_path: String) -> Result<HeroiConfig, String> {
    let config_path = Path::new(&worktree_path).join("heroi.json");
    if !config_path.exists() {
        return Ok(HeroiConfig::default());
    }
    let content =
        std::fs::read_to_string(&config_path).map_err(|e| format!("Failed to read heroi.json: {}", e))?;
    let config: HeroiConfig =
        serde_json::from_str(&content).map_err(|e| format!("Invalid heroi.json: {}", e))?;
    Ok(config)
}

/// Save heroi.json to a workspace's worktree path.
#[tauri::command]
pub fn save_heroi_config(worktree_path: String, config: HeroiConfig) -> Result<(), String> {
    let config_path = Path::new(&worktree_path).join("heroi.json");
    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&config_path, content).map_err(|e| format!("Failed to write heroi.json: {}", e))?;
    Ok(())
}

/// Run a script in the background. Returns a RunningProcess entry.
#[tauri::command]
pub fn run_script(
    workspace_id: String,
    script: ScriptDef,
    worktree_path: String,
    extra_env: HashMap<String, String>,
    state: State<'_, AppState>,
) -> Result<RunningProcess, String> {
    let (cmd, args) = resolve_platform_command(&script);

    let working_dir = if let Some(ref cwd) = script.cwd {
        Path::new(&worktree_path).join(cwd)
    } else {
        Path::new(&worktree_path).to_path_buf()
    };

    if !working_dir.exists() {
        return Err(format!("Working directory does not exist: {}", working_dir.display()));
    }

    let child = Command::new(&cmd)
        .args(&args)
        .current_dir(&working_dir)
        .envs(&extra_env)
        .spawn()
        .map_err(|e| format!("Failed to spawn '{}': {}", cmd, e))?;

    let pid = child.id();

    let process = RunningProcess {
        id: format!("{}-{}", workspace_id, pid),
        workspace_id,
        script_name: script.name,
        pid,
        status: ProcessStatus::Running,
    };

    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.running_processes.push(process.clone());

    Ok(process)
}

/// Stop a running process by its ID.
#[tauri::command]
pub fn stop_process(process_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let process = data
        .running_processes
        .iter()
        .find(|p| p.id == process_id)
        .cloned()
        .ok_or_else(|| format!("Process '{}' not found", process_id))?;

    // Kill the process
    kill_process(process.pid)?;

    // Update status
    for p in data.running_processes.iter_mut() {
        if p.id == process_id {
            p.status = ProcessStatus::Exited;
        }
    }

    Ok(())
}

/// List running processes, optionally filtered by workspace.
#[tauri::command]
pub fn list_running_processes(
    workspace_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<RunningProcess>, String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    // Check which processes are still alive and update status
    for p in data.running_processes.iter_mut() {
        if p.status == ProcessStatus::Running && !is_process_alive(p.pid) {
            p.status = ProcessStatus::Exited;
        }
    }

    let processes: Vec<RunningProcess> = match workspace_id {
        Some(ref wid) => data
            .running_processes
            .iter()
            .filter(|p| &p.workspace_id == wid)
            .cloned()
            .collect(),
        None => data.running_processes.clone(),
    };

    Ok(processes)
}

/// Clean up exited processes from state.
#[tauri::command]
pub fn cleanup_processes(state: State<'_, AppState>) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.running_processes
        .retain(|p| p.status == ProcessStatus::Running);
    Ok(())
}

fn resolve_platform_command(script: &ScriptDef) -> (String, Vec<String>) {
    #[cfg(target_os = "windows")]
    {
        let cmd = script
            .command_windows
            .clone()
            .unwrap_or_else(|| script.command.clone());
        let args = script
            .args_windows
            .clone()
            .unwrap_or_else(|| script.args.clone());
        (cmd, args)
    }
    #[cfg(not(target_os = "windows"))]
    {
        (script.command.clone(), script.args.clone())
    }
}

fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill process {}: {}", pid, e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Send SIGTERM to process group
        unsafe {
            libc::kill(-(pid as i32), libc::SIGTERM);
        }
        Ok(())
    }
}

fn is_process_alive(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output()
            .map(|o| {
                let out = String::from_utf8_lossy(&o.stdout);
                out.contains(&pid.to_string())
            })
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }
}
