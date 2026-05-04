use std::path::Path;

use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::commands::util::{deterministic_id, now_iso8601};
use crate::commands::worktrees::get_default_branch;
use crate::models::project::Project;
use crate::models::repo::RepoEntry;
use crate::state::AppState;

pub(crate) const KEY_PROJECTS: &str = "projects";

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    Ok(data.projects.clone())
}

#[tauri::command]
pub fn add_project(
    repo_path: String,
    name: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    let path = Path::new(&repo_path);
    if !path.exists() {
        return Err("Repository path does not exist".into());
    }

    let repo = git2::Repository::open(&repo_path)
        .map_err(|e| format!("Not a valid git repository: {}", e))?;

    let primary_checkout_path = repo
        .workdir()
        .map(|p| {
            p.to_string_lossy()
                .trim_end_matches(['/', '\\'])
                .to_string()
        })
        .unwrap_or_else(|| repo_path.clone());

    let resolved_name = name.unwrap_or_else(|| {
        path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| repo_path.clone())
    });

    let default_base_branch =
        get_default_branch(repo_path.clone()).unwrap_or_else(|_| "main".to_string());

    let project = Project {
        id: deterministic_id("proj", &repo_path),
        name: resolved_name.clone(),
        repo_path: repo_path.clone(),
        primary_checkout_path,
        default_base_branch,
        created_at: now_iso8601(),
        archived_at: None,
    };

    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    if data.projects.iter().any(|p| p.id == project.id) {
        return Err("Project already exists for this repository".into());
    }

    if !data.repos.iter().any(|r| r.path == repo_path) {
        data.repos.push(RepoEntry {
            path: repo_path.clone(),
            name: resolved_name,
        });
        let repos = data.repos.clone();
        crate::commands::repos::persist_repos(&app, &repos)?;
    }

    data.projects.push(project.clone());
    let projects = data.projects.clone();
    drop(data);

    persist_projects(&app, &projects)?;
    Ok(project)
}

#[tauri::command]
pub fn rename_project(
    project_id: String,
    name: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    let project = data
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;
    project.name = name;
    let projects = data.projects.clone();
    drop(data);
    persist_projects(&app, &projects)?;
    Ok(())
}

#[tauri::command]
pub fn archive_project(
    project_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    let project = data
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;
    project.archived_at = Some(now_iso8601());
    let projects = data.projects.clone();
    drop(data);
    persist_projects(&app, &projects)?;
    Ok(())
}

#[tauri::command]
pub fn restore_project(
    project_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    let project = data
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;
    project.archived_at = None;
    let projects = data.projects.clone();
    drop(data);
    persist_projects(&app, &projects)?;
    Ok(())
}

/// Refuses to delete a project that still has non-archived conversations.
#[tauri::command]
pub fn delete_project(
    project_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;

    let active = data
        .conversations
        .iter()
        .filter(|c| c.project_id == project_id && c.archived_at.is_none())
        .count();
    if active > 0 {
        return Err(format!(
            "Project has {} active conversation(s). Archive or delete them first.",
            active
        ));
    }

    data.projects.retain(|p| p.id != project_id);
    let projects = data.projects.clone();
    drop(data);
    persist_projects(&app, &projects)?;
    Ok(())
}

pub(crate) fn persist_projects(
    app: &tauri::AppHandle,
    projects: &[Project],
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set(
        KEY_PROJECTS,
        serde_json::to_value(projects).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_projects(app: &tauri::AppHandle, state: &AppState) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    if let Some(val) = store.get(KEY_PROJECTS) {
        let projects: Vec<Project> =
            serde_json::from_value(val.clone()).map_err(|e| e.to_string())?;
        let mut data = state.0.lock().map_err(|e| e.to_string())?;
        data.projects = projects;
    }
    Ok(())
}
