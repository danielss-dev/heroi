use std::process::Command;

use crate::models::github::{CheckRun, MergeMethod, PrInfo};

/// Check if gh CLI is available
#[tauri::command]
pub fn check_gh_available() -> Result<bool, String> {
    let output = Command::new("gh")
        .arg("--version")
        .output()
        .map_err(|_| "gh CLI not found".to_string())?;
    Ok(output.status.success())
}

/// Create a pull request
#[tauri::command]
pub fn create_pr(
    worktree_path: String,
    title: String,
    body: String,
    base_branch: Option<String>,
    draft: bool,
) -> Result<PrInfo, String> {
    // Push first
    let push = Command::new("git")
        .current_dir(&worktree_path)
        .args(["push", "-u", "origin", "HEAD"])
        .output()
        .map_err(|e| format!("Failed to push: {}", e))?;

    if !push.status.success() {
        let stderr = String::from_utf8_lossy(&push.stderr);
        return Err(format!("git push failed: {}", stderr));
    }

    let mut cmd = Command::new("gh");
    cmd.current_dir(&worktree_path);
    cmd.args(["pr", "create", "--title", &title, "--body", &body]);

    if let Some(ref base) = base_branch {
        cmd.args(["--base", base]);
    }

    if draft {
        cmd.arg("--draft");
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh pr create failed: {}", stderr));
    }

    // Get the PR info
    get_pr_status(worktree_path)
}

/// Get status of the current branch's PR
#[tauri::command]
pub fn get_pr_status(worktree_path: String) -> Result<PrInfo, String> {
    let output = Command::new("gh")
        .current_dir(&worktree_path)
        .args([
            "pr", "view", "--json",
            "number,title,state,url,headRefName,baseRefName,isDraft,mergeable,additions,deletions,changedFiles",
        ])
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("No PR found for current branch: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse gh output: {}", e))?;

    Ok(PrInfo {
        number: json["number"].as_u64().unwrap_or(0),
        title: json["title"].as_str().unwrap_or("").to_string(),
        state: json["state"].as_str().unwrap_or("UNKNOWN").to_string(),
        url: json["url"].as_str().unwrap_or("").to_string(),
        head_branch: json["headRefName"].as_str().unwrap_or("").to_string(),
        base_branch: json["baseRefName"].as_str().unwrap_or("").to_string(),
        draft: json["isDraft"].as_bool().unwrap_or(false),
        mergeable: json["mergeable"].as_str().map(|s| s.to_string()),
        additions: json["additions"].as_u64().unwrap_or(0),
        deletions: json["deletions"].as_u64().unwrap_or(0),
        changed_files: json["changedFiles"].as_u64().unwrap_or(0),
    })
}

/// List CI checks on the PR
#[tauri::command]
pub fn list_pr_checks(worktree_path: String) -> Result<Vec<CheckRun>, String> {
    let output = Command::new("gh")
        .current_dir(&worktree_path)
        .args(["pr", "checks", "--json", "name,state,conclusion"])
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: Vec<serde_json::Value> =
        serde_json::from_str(&stdout).unwrap_or_default();

    let checks: Vec<CheckRun> = json
        .iter()
        .map(|c| CheckRun {
            name: c["name"].as_str().unwrap_or("").to_string(),
            status: c["state"].as_str().unwrap_or("").to_string(),
            conclusion: c["conclusion"].as_str().map(|s| s.to_string()),
        })
        .collect();

    Ok(checks)
}

/// Merge the PR
#[tauri::command]
pub fn merge_pr(
    worktree_path: String,
    method: MergeMethod,
    delete_branch: bool,
) -> Result<(), String> {
    let mut cmd = Command::new("gh");
    cmd.current_dir(&worktree_path);
    cmd.args(["pr", "merge", method.as_flag()]);

    if delete_branch {
        cmd.arg("--delete-branch");
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh pr merge failed: {}", stderr));
    }

    Ok(())
}
