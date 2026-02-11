use std::process::Command;

#[tauri::command]
pub fn open_in_ide(worktree_path: String, ide: String) -> Result<(), String> {
    let program = match ide.as_str() {
        "vscode" => "code",
        "cursor" => "cursor",
        "zed" => "zed",
        _ => return Err(format!("Unknown IDE: {}", ide)),
    };

    Command::new(program)
        .arg(&worktree_path)
        .spawn()
        .map_err(|e| format!("Failed to open {}: {}", ide, e))?;

    Ok(())
}
