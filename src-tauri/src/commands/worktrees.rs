use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::models::repo::WorktreeInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_remote: bool,
    pub is_head: bool,
}

#[tauri::command]
pub fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = git2::Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut branches = Vec::new();

    // Local branches
    if let Ok(local) = repo.branches(Some(git2::BranchType::Local)) {
        for item in local {
            if let Ok((branch, _)) = item {
                if let Ok(Some(name)) = branch.name() {
                    let is_head = branch.is_head();
                    branches.push(BranchInfo {
                        name: name.to_string(),
                        is_remote: false,
                        is_head,
                    });
                }
            }
        }
    }

    // Remote branches
    if let Ok(remote) = repo.branches(Some(git2::BranchType::Remote)) {
        for item in remote {
            if let Ok((branch, _)) = item {
                if let Ok(Some(name)) = branch.name() {
                    // Skip HEAD pointers like origin/HEAD
                    if name.ends_with("/HEAD") {
                        continue;
                    }
                    branches.push(BranchInfo {
                        name: name.to_string(),
                        is_remote: true,
                        is_head: false,
                    });
                }
            }
        }
    }

    Ok(branches)
}

#[tauri::command]
pub fn get_default_branch(repo_path: String) -> Result<String, String> {
    let repo = git2::Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    // Try to find origin/HEAD reference to determine default branch
    if let Ok(reference) = repo.find_reference("refs/remotes/origin/HEAD") {
        if let Ok(resolved) = reference.resolve() {
            if let Some(name) = resolved.shorthand() {
                return Ok(name.to_string());
            }
        }
    }

    // Fallback: check for common default branch names
    for candidate in &["origin/main", "origin/master"] {
        let refname = format!("refs/remotes/{}", candidate);
        if repo.find_reference(&refname).is_ok() {
            return Ok(candidate.to_string());
        }
    }

    // Last fallback: use HEAD
    if let Ok(head) = repo.head() {
        if let Some(name) = head.shorthand() {
            return Ok(name.to_string());
        }
    }

    Ok("main".to_string())
}

#[tauri::command]
pub fn list_worktrees(repo_path: String) -> Result<Vec<WorktreeInfo>, String> {
    let repo = git2::Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut worktrees = Vec::new();

    // Add the main worktree
    let main_path = repo.workdir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| repo_path.clone());

    let main_branch = repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    // Normalize path: remove trailing slash
    let main_path_clean = main_path.trim_end_matches('/').trim_end_matches('\\').to_string();

    worktrees.push(WorktreeInfo {
        name: "main".to_string(),
        path: main_path_clean,
        branch: main_branch,
        is_main: true,
    });

    // List additional worktrees
    if let Ok(wt_names) = repo.worktrees() {
        for i in 0..wt_names.len() {
            if let Some(name) = wt_names.get(i) {
                if let Ok(wt) = repo.find_worktree(name) {
                    // wt.path() returns the internal .git/worktrees/<name> path.
                    // We need the actual working directory path instead.
                    // Read the gitdir file to resolve the real worktree path.
                    let gitdir_path = wt.path().join("gitdir");
                    let wt_path = if gitdir_path.exists() {
                        // The gitdir file contains the path to the .git file in the worktree
                        // e.g. "D:/GitSources/critica-test-heroi/.git\n"
                        let gitdir_content = std::fs::read_to_string(&gitdir_path)
                            .unwrap_or_default();
                        let git_file = gitdir_content.trim();
                        // Go up one level from the .git file to get the worktree dir
                        Path::new(git_file)
                            .parent()
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_else(|| wt.path().to_string_lossy().to_string())
                    } else {
                        wt.path().to_string_lossy().to_string()
                    };

                    let branch = get_worktree_branch(&wt_path);

                    worktrees.push(WorktreeInfo {
                        name: name.to_string(),
                        path: wt_path,
                        branch,
                        is_main: false,
                    });
                }
            }
        }
    }

    Ok(worktrees)
}

fn get_worktree_branch(wt_path: &str) -> Option<String> {
    let wt_repo = git2::Repository::open(wt_path).ok()?;
    let head = wt_repo.head().ok()?;
    head.shorthand().map(|s| s.to_string())
}

#[tauri::command]
pub fn create_worktree(
    repo_path: String,
    name: String,
    branch: Option<String>,
    base_branch: Option<String>,
) -> Result<WorktreeInfo, String> {
    let repo_dir = Path::new(&repo_path);
    let worktrees_dir = repo_dir.join(".worktrees");
    // Create the .worktrees directory if it doesn't exist
    if !worktrees_dir.exists() {
        std::fs::create_dir_all(&worktrees_dir)
            .map_err(|e| format!("Failed to create .worktrees directory: {}", e))?;
    }
    let wt_path = worktrees_dir.join(&name);

    // git worktree add -b <new_branch> <path> <base>
    let new_branch = branch.unwrap_or_else(|| name.clone());

    let mut cmd = Command::new("git");
    cmd.current_dir(&repo_path);
    cmd.arg("worktree")
        .arg("add")
        .arg("-b")
        .arg(&new_branch)
        .arg(wt_path.to_string_lossy().to_string());

    // If a base branch is specified, append it as the start point
    if let Some(ref base) = base_branch {
        cmd.arg(base);
    }

    let output = cmd.output().map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree add failed: {}", stderr));
    }

    Ok(WorktreeInfo {
        name,
        path: wt_path.to_string_lossy().to_string(),
        branch: Some(new_branch),
        is_main: false,
    })
}

#[tauri::command]
pub fn remove_worktree(repo_path: String, worktree_path: String) -> Result<(), String> {
    let wt_dir = Path::new(&worktree_path);

    // First try: git worktree remove --force
    let output = Command::new("git")
        .current_dir(&repo_path)
        .arg("worktree")
        .arg("remove")
        .arg("--force")
        .arg(&worktree_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        // If git worktree remove failed, try to prune and remove manually
        let _ = Command::new("git")
            .current_dir(&repo_path)
            .arg("worktree")
            .arg("prune")
            .output();

        // Remove the directory if it still exists
        if wt_dir.exists() {
            std::fs::remove_dir_all(wt_dir)
                .map_err(|e| format!("Failed to remove worktree directory: {}", e))?;
        }

        // Prune again to clean up stale references
        let _ = Command::new("git")
            .current_dir(&repo_path)
            .arg("worktree")
            .arg("prune")
            .output();
    }

    // Final safety: if the directory still exists, remove it
    if wt_dir.exists() {
        std::fs::remove_dir_all(wt_dir)
            .map_err(|e| format!("Failed to remove worktree directory: {}", e))?;
    }

    Ok(())
}
