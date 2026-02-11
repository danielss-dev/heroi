use std::path::Path;

use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::models::repo::RepoEntry;
use crate::state::AppState;

#[tauri::command]
pub fn add_repo(
    path: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<RepoEntry, String> {
    let repo_path = Path::new(&path);
    if !repo_path.exists() {
        return Err("Path does not exist".into());
    }

    // Validate it's a git repo
    git2::Repository::open(&path).map_err(|e| format!("Not a valid git repository: {}", e))?;

    let name = repo_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let entry = RepoEntry {
        path: path.clone(),
        name,
    };

    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    // Check if already added
    if data.repos.iter().any(|r| r.path == path) {
        return Err("Repository already added".into());
    }

    data.repos.push(entry.clone());
    let repos = data.repos.clone();
    drop(data);

    // Persist
    persist_repos(&app, &repos)?;

    Ok(entry)
}

#[tauri::command]
pub fn remove_repo(
    path: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.repos.retain(|r| r.path != path);
    let repos = data.repos.clone();
    drop(data);

    persist_repos(&app, &repos)?;
    Ok(())
}

#[tauri::command]
pub fn list_repos(state: State<'_, AppState>) -> Result<Vec<RepoEntry>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    Ok(data.repos.clone())
}

fn persist_repos(app: &tauri::AppHandle, repos: &[RepoEntry]) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set(
        "repos",
        serde_json::to_value(repos).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_repos(app: &tauri::AppHandle, state: &AppState) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    if let Some(val) = store.get("repos") {
        let repos: Vec<RepoEntry> =
            serde_json::from_value(val.clone()).map_err(|e| e.to_string())?;
        let mut data = state.0.lock().map_err(|e| e.to_string())?;
        data.repos = repos;
    }
    Ok(())
}
