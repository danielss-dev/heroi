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

#[tauri::command]
pub fn open_file_in_ide(
    worktree_path: String,
    file_path: String,
    ide: String,
) -> Result<(), String> {
    let program = match ide.as_str() {
        "vscode" => "code",
        "cursor" => "cursor",
        "zed" => "zed",
        _ => return Err(format!("Unknown IDE: {}", ide)),
    };

    let full_path = std::path::Path::new(&worktree_path).join(&file_path);

    Command::new(program)
        .arg("--goto")
        .arg(full_path.to_string_lossy().as_ref())
        .spawn()
        .map_err(|e| format!("Failed to open file in {}: {}", ide, e))?;

    Ok(())
}
