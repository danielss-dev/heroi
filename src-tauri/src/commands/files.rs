use std::path::Path;

use crate::models::file::{DirEntry, FileContent, FileType};

/// List directory contents, sorted: dirs first, then files, alphabetically.
#[tauri::command]
pub fn list_directory(dir_path: String) -> Result<Vec<DirEntry>, String> {
    let path = Path::new(&dir_path);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir_path));
    }

    let mut entries = Vec::new();
    let read_dir = std::fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and common noisy directories
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "__pycache__" {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        let is_dir = metadata.is_dir();
        let size = if is_dir { 0 } else { metadata.len() };

        let ext = Path::new(&name)
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();

        let file_type = if is_dir {
            FileType::Unknown
        } else {
            FileType::from_extension(&ext)
        };

        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            size,
            file_type,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

/// Read a file's content (text files only, max 1MB).
#[tauri::command]
pub fn read_file(file_path: String) -> Result<FileContent, String> {
    let path = Path::new(&file_path);
    if !path.is_file() {
        return Err(format!("Not a file: {}", file_path));
    }

    let metadata = std::fs::metadata(&file_path).map_err(|e| format!("Failed to read metadata: {}", e))?;
    let size = metadata.len();

    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();
    let file_type = FileType::from_extension(&ext);

    // Don't read binary files or files > 1MB
    if file_type == FileType::Binary || file_type == FileType::Image {
        return Ok(FileContent {
            path: file_path,
            content: String::new(),
            file_type,
            size,
        });
    }

    if size > 1_048_576 {
        return Ok(FileContent {
            path: file_path,
            content: format!("File too large to preview ({} bytes)", size),
            file_type,
            size,
        });
    }

    let content = std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(FileContent {
        path: file_path,
        content,
        file_type,
        size,
    })
}

/// Check if a file exists.
#[tauri::command]
pub fn file_exists(file_path: String) -> bool {
    Path::new(&file_path).exists()
}
