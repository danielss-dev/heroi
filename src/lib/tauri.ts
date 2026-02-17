import { invoke } from "@tauri-apps/api/core";
import type {
  RepoEntry,
  WorktreeInfo,
  BranchInfo,
  GitFileStatus,
  DiffOutput,
  AgentDef,
  IdeType,
  Settings,
  Workspace,
  WorkspaceConfig,
  HeroiConfig,
  ScriptDef,
  RunningProcess,
  PrInfo,
  CheckRun,
  MergeMethod,
  DirEntry,
  FileContent,
  Checkpoint,
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

export async function gitDiffAll(
  worktreePath: string
): Promise<DiffOutput[]> {
  return invoke("git_diff_all", { worktreePath });
}

export async function gitDiffBase(
  worktreePath: string,
  baseBranch: string
): Promise<DiffOutput[]> {
  return invoke("git_diff_base", { worktreePath, baseBranch });
}

export async function gitFileContent(
  worktreePath: string,
  filePath: string,
  refName?: string
): Promise<string> {
  return invoke("git_file_content", { worktreePath, filePath, refName });
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

export async function gitStageAll(worktreePath: string): Promise<void> {
  return invoke("git_stage_all", { worktreePath });
}

export async function gitUnstageAll(worktreePath: string): Promise<void> {
  return invoke("git_unstage_all", { worktreePath });
}

export async function gitCommit(
  worktreePath: string,
  message: string
): Promise<string> {
  return invoke("git_commit", { worktreePath, message });
}

export async function gitPush(worktreePath: string): Promise<void> {
  return invoke("git_push", { worktreePath });
}

export async function gitAheadCount(worktreePath: string): Promise<number> {
  return invoke("git_ahead_count", { worktreePath });
}

export async function openInIde(
  worktreePath: string,
  ide: IdeType
): Promise<void> {
  return invoke("open_in_ide", { worktreePath, ide });
}

export async function openFileInIde(
  worktreePath: string,
  filePath: string,
  ide: IdeType
): Promise<void> {
  return invoke("open_file_in_ide", { worktreePath, filePath, ide });
}

export async function listAgents(): Promise<AgentDef[]> {
  return invoke("list_agents");
}

export async function saveSettings(settings: Settings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function loadSettings(): Promise<Settings | null> {
  return invoke("load_settings");
}

export async function saveWorkspaces(
  workspaces: Workspace[],
  activeWorkspaceId: string | null
): Promise<void> {
  return invoke("save_workspaces", { workspaces, activeWorkspaceId });
}

export async function loadWorkspaces(): Promise<{
  workspaces: Workspace[] | null;
  activeWorkspaceId: string | null;
}> {
  return invoke("load_workspaces");
}

// Workspace lifecycle commands (backed by Rust + git worktrees)

export async function createWorkspaceWithWorktree(
  repoPath: string,
  name: string,
  branch?: string,
  baseBranch?: string
): Promise<WorkspaceConfig> {
  return invoke("create_workspace", { repoPath, name, branch, baseBranch });
}

export async function createWorkspaceForMain(
  repoPath: string,
  name: string
): Promise<WorkspaceConfig> {
  return invoke("create_workspace_for_main", { repoPath, name });
}

export async function deleteWorkspaceWithWorktree(
  workspaceId: string
): Promise<void> {
  return invoke("delete_workspace", { workspaceId });
}

export async function getWorkspaceEnv(
  workspaceId: string
): Promise<Record<string, string>> {
  return invoke("get_workspace_env", { workspaceId });
}

export async function archiveWorkspace(workspaceId: string): Promise<void> {
  return invoke("archive_workspace", { workspaceId });
}

export async function restoreWorkspace(workspaceId: string): Promise<void> {
  return invoke("restore_workspace", { workspaceId });
}

export async function saveWorkspaceNotes(
  workspaceId: string,
  notes: string
): Promise<void> {
  return invoke("save_workspace_notes", { workspaceId, notes });
}

export async function loadWorkspaceNotes(
  workspaceId: string
): Promise<string> {
  return invoke("load_workspace_notes", { workspaceId });
}

export async function listWorkspaceConfigs(): Promise<WorkspaceConfig[]> {
  return invoke("list_workspace_configs");
}

// Scripts commands

export async function loadHeroiConfig(
  worktreePath: string
): Promise<HeroiConfig> {
  return invoke("load_heroi_config", { worktreePath });
}

export async function saveHeroiConfig(
  worktreePath: string,
  config: HeroiConfig
): Promise<void> {
  return invoke("save_heroi_config", { worktreePath, config });
}

export async function runScript(
  workspaceId: string,
  script: ScriptDef,
  worktreePath: string,
  extraEnv: Record<string, string>
): Promise<RunningProcess> {
  return invoke("run_script", { workspaceId, script, worktreePath, extraEnv });
}

export async function stopProcess(processId: string): Promise<void> {
  return invoke("stop_process", { processId });
}

export async function listRunningProcesses(
  workspaceId?: string
): Promise<RunningProcess[]> {
  return invoke("list_running_processes", { workspaceId });
}

export async function cleanupProcesses(): Promise<void> {
  return invoke("cleanup_processes");
}

// GitHub / PR commands

export async function checkGhAvailable(): Promise<boolean> {
  return invoke("check_gh_available");
}

export async function createPr(
  worktreePath: string,
  title: string,
  body: string,
  baseBranch?: string,
  draft?: boolean
): Promise<PrInfo> {
  return invoke("create_pr", {
    worktreePath,
    title,
    body,
    baseBranch,
    draft: draft ?? false,
  });
}

export async function getPrStatus(worktreePath: string): Promise<PrInfo> {
  return invoke("get_pr_status", { worktreePath });
}

export async function listPrChecks(
  worktreePath: string
): Promise<CheckRun[]> {
  return invoke("list_pr_checks", { worktreePath });
}

export async function mergePr(
  worktreePath: string,
  method: MergeMethod,
  deleteBranch?: boolean
): Promise<void> {
  return invoke("merge_pr", {
    worktreePath,
    method,
    deleteBranch: deleteBranch ?? true,
  });
}

// File browser commands

export async function listDirectory(dirPath: string): Promise<DirEntry[]> {
  return invoke("list_directory", { dirPath });
}

export async function readFile(filePath: string): Promise<FileContent> {
  return invoke("read_file", { filePath });
}

export async function fileExists(filePath: string): Promise<boolean> {
  return invoke("file_exists", { filePath });
}

// Checkpoint commands

export async function createCheckpoint(
  workspaceId: string,
  worktreePath: string,
  label: string,
  agentId?: string
): Promise<Checkpoint> {
  return invoke("create_checkpoint", { workspaceId, worktreePath, label, agentId });
}

export async function listCheckpoints(
  workspaceId: string
): Promise<Checkpoint[]> {
  return invoke("list_checkpoints", { workspaceId });
}

export async function restoreCheckpoint(
  worktreePath: string,
  gitRef: string
): Promise<void> {
  return invoke("restore_checkpoint", { worktreePath, gitRef });
}

export async function deleteCheckpoint(checkpointId: string): Promise<void> {
  return invoke("delete_checkpoint", { checkpointId });
}

export async function diffCheckpoint(
  worktreePath: string,
  fromRef: string,
  toRef?: string
): Promise<string> {
  return invoke("diff_checkpoint", { worktreePath, fromRef, toRef });
}
