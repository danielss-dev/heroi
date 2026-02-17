use git2::{DiffOptions, Repository, StatusOptions};
use std::process::Command;

use crate::models::git::{DiffOutput, FileState, GitFileStatus};

#[tauri::command]
pub fn git_status(worktree_path: String) -> Result<Vec<GitFileStatus>, String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let mut result = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        let staged = if status.is_index_new() {
            FileState::Added
        } else if status.is_index_modified() {
            FileState::Modified
        } else if status.is_index_deleted() {
            FileState::Deleted
        } else if status.is_index_renamed() {
            FileState::Renamed
        } else if status.is_index_typechange() {
            FileState::Typechange
        } else {
            FileState::Unmodified
        };

        let unstaged = if status.is_wt_new() {
            FileState::Untracked
        } else if status.is_wt_modified() {
            FileState::Modified
        } else if status.is_wt_deleted() {
            FileState::Deleted
        } else if status.is_wt_renamed() {
            FileState::Renamed
        } else if status.is_wt_typechange() {
            FileState::Typechange
        } else if status.is_conflicted() {
            FileState::Conflicted
        } else {
            FileState::Unmodified
        };

        if staged != FileState::Unmodified || unstaged != FileState::Unmodified {
            result.push(GitFileStatus {
                path,
                staged,
                unstaged,
            });
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn git_diff(worktree_path: String) -> Result<String, String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| format!("Failed to get diff: {}", e))?;

    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        if origin == '+' || origin == '-' || origin == ' ' {
            diff_text.push(origin);
        }
        diff_text.push_str(&String::from_utf8_lossy(line.content()));
        true
    })
    .map_err(|e| format!("Failed to print diff: {}", e))?;

    Ok(diff_text)
}

#[tauri::command]
pub fn git_diff_file(worktree_path: String, file_path: String) -> Result<DiffOutput, String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut opts = DiffOptions::new();
    opts.pathspec(&file_path);

    // Try index-to-workdir first (unstaged changes)
    let diff = repo
        .diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| format!("Failed to get diff: {}", e))?;

    let mut diff_text = String::new();

    if diff.stats().map(|s| s.files_changed()).unwrap_or(0) == 0 {
        // Try HEAD-to-index (staged changes)
        let head = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        let diff = repo
            .diff_tree_to_index(head.as_ref(), None, Some(&mut opts))
            .map_err(|e| format!("Failed to get staged diff: {}", e))?;

        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let origin = line.origin();
            if origin == '+' || origin == '-' || origin == ' ' {
                diff_text.push(origin);
            }
            diff_text.push_str(&String::from_utf8_lossy(line.content()));
            true
        })
        .map_err(|e| format!("Failed to print diff: {}", e))?;
    } else {
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let origin = line.origin();
            if origin == '+' || origin == '-' || origin == ' ' {
                diff_text.push(origin);
            }
            diff_text.push_str(&String::from_utf8_lossy(line.content()));
            true
        })
        .map_err(|e| format!("Failed to print diff: {}", e))?;
    }

    Ok(DiffOutput {
        file_path,
        diff_text,
    })
}

#[tauri::command]
pub fn git_stage_file(worktree_path: String, file_path: String) -> Result<(), String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;

    // Check if the file exists on disk
    let full_path = std::path::Path::new(&worktree_path).join(&file_path);
    if full_path.exists() {
        index
            .add_path(std::path::Path::new(&file_path))
            .map_err(|e| format!("Failed to stage file: {}", e))?;
    } else {
        index
            .remove_path(std::path::Path::new(&file_path))
            .map_err(|e| format!("Failed to stage deleted file: {}", e))?;
    }

    index
        .write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn git_unstage_file(worktree_path: String, file_path: String) -> Result<(), String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get commit: {}", e))?;
    let head_tree = head_commit
        .tree()
        .map_err(|e| format!("Failed to get tree: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;

    // Check if file existed in HEAD
    if head_tree.get_path(std::path::Path::new(&file_path)).is_ok() {
        // Reset to HEAD version
        repo.reset_default(Some(head_commit.as_object()), [&file_path])
            .map_err(|e| format!("Failed to unstage: {}", e))?;
    } else {
        // File is newly added — remove from index
        index
            .remove_path(std::path::Path::new(&file_path))
            .map_err(|e| format!("Failed to unstage: {}", e))?;
        index
            .write()
            .map_err(|e| format!("Failed to write index: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn git_stage_all(worktree_path: String) -> Result<(), String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;

    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("Failed to stage all: {}", e))?;

    // Also handle deleted files
    index
        .update_all(["*"].iter(), None)
        .map_err(|e| format!("Failed to update index: {}", e))?;

    index
        .write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn git_unstage_all(worktree_path: String) -> Result<(), String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let head = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

    match head {
        Some(commit) => {
            repo.reset(
                commit.as_object(),
                git2::ResetType::Mixed,
                None,
            )
            .map_err(|e| format!("Failed to unstage all: {}", e))?;
        }
        None => {
            // No commits yet — clear the index
            let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;
            index.clear().map_err(|e| format!("Failed to clear index: {}", e))?;
            index.write().map_err(|e| format!("Failed to write index: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn git_commit(worktree_path: String, message: String) -> Result<String, String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let sig = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;
    let tree_oid = index
        .write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.as_ref().map(|p| vec![p]).unwrap_or_default();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| format!("Failed to commit: {}", e))?;

    Ok(oid.to_string())
}

#[tauri::command]
pub fn git_push(worktree_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("push")
        .current_dir(&worktree_path)
        .output()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git push failed: {}", stderr));
    }

    Ok(())
}

#[tauri::command]
pub fn git_ahead_count(worktree_path: String) -> Result<usize, String> {
    let repo =
        Repository::open(&worktree_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let local_oid = head
        .target()
        .ok_or_else(|| "HEAD has no target".to_string())?;

    let branch_name = head
        .shorthand()
        .ok_or_else(|| "Could not get branch name".to_string())?;

    let upstream_ref = format!("refs/remotes/origin/{}", branch_name);
    let upstream = match repo.find_reference(&upstream_ref) {
        Ok(r) => r,
        Err(_) => return Ok(0), // No upstream tracked
    };

    let upstream_oid = upstream
        .target()
        .ok_or_else(|| "Upstream has no target".to_string())?;

    let (ahead, _behind) = repo
        .graph_ahead_behind(local_oid, upstream_oid)
        .map_err(|e| format!("Failed to compute ahead/behind: {}", e))?;

    Ok(ahead)
}
