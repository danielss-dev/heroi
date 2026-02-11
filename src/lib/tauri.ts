import { invoke } from "@tauri-apps/api/core";
import type {
  RepoEntry,
  WorktreeInfo,
  BranchInfo,
  GitFileStatus,
  DiffOutput,
  AgentDef,
  IdeType,
} from "../types";

export async function addRepo(path: string): Promise<RepoEntry> {
  return invoke("add_repo", { path });
}

export async function removeRepo(path: string): Promise<void> {
  return invoke("remove_repo", { path });
}

export async function listRepos(): Promise<RepoEntry[]> {
  return invoke("list_repos");
}

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  return invoke("list_worktrees", { repoPath });
}

export async function listBranches(repoPath: string): Promise<BranchInfo[]> {
  return invoke("list_branches", { repoPath });
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  return invoke("get_default_branch", { repoPath });
}

export async function createWorktree(
  repoPath: string,
  name: string,
  branch?: string,
  baseBranch?: string
): Promise<WorktreeInfo> {
  return invoke("create_worktree", { repoPath, name, branch, baseBranch });
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string
): Promise<void> {
  return invoke("remove_worktree", { repoPath, worktreePath });
}

export async function gitStatus(
  worktreePath: string
): Promise<GitFileStatus[]> {
  return invoke("git_status", { worktreePath });
}

export async function gitDiff(worktreePath: string): Promise<string> {
  return invoke("git_diff", { worktreePath });
}

export async function gitDiffFile(
  worktreePath: string,
  filePath: string
): Promise<DiffOutput> {
  return invoke("git_diff_file", { worktreePath, filePath });
}

export async function gitStageFile(
  worktreePath: string,
  filePath: string
): Promise<void> {
  return invoke("git_stage_file", { worktreePath, filePath });
}

export async function gitUnstageFile(
  worktreePath: string,
  filePath: string
): Promise<void> {
  return invoke("git_unstage_file", { worktreePath, filePath });
}

export async function openInIde(
  worktreePath: string,
  ide: IdeType
): Promise<void> {
  return invoke("open_in_ide", { worktreePath, ide });
}

export async function listAgents(): Promise<AgentDef[]> {
  return invoke("list_agents");
}
