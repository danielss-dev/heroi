export interface RepoEntry {
  path: string;
  name: string;
}

export interface WorktreeInfo {
  name: string;
  path: string;
  branch: string | null;
  is_main: boolean;
}

export type FileState =
  | "Unmodified"
  | "Added"
  | "Modified"
  | "Deleted"
  | "Renamed"
  | "Typechange"
  | "Untracked"
  | "Conflicted";

export interface GitFileStatus {
  path: string;
  staged: FileState;
  unstaged: FileState;
}

export interface DiffOutput {
  file_path: string;
  diff_text: string;
}

export interface AgentDef {
  id: string;
  name: string;
  command: string;
  args: string[];
  description: string;
}

export interface BranchInfo {
  name: string;
  is_remote: boolean;
  is_head: boolean;
}

export type IdeType = "vscode" | "cursor" | "zed";

export type ShellType = "bash" | "zsh" | "fish" | "sh" | "powershell" | "cmd";

export interface AgentArgsConfig {
  flags: Record<string, boolean>;
  extraArgs: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  envVarName: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
}

export interface Settings {
  defaultAgentId: string;
  gitPollInterval: number;
  defaultIde: IdeType;
  defaultShell: ShellType;
  agentArgs: Record<string, AgentArgsConfig>;
  providers: ProviderConfig[];
}

export interface AgentTab {
  id: string;
  agentId: string;
  label: string;
  worktreePath: string;
}

export type WorkspaceStatus = "active" | "archived";

export interface Workspace {
  id: string;
  name: string;
  // Workspace-worktree binding
  repoPath: string;
  worktreePath: string;
  branch: string;
  isMainWorktree: boolean;
  portBase: number;
  status: WorkspaceStatus;
  createdAt: string;
  envVars: Record<string, string>;
  // UI state
  worktreeTabs: Record<string, AgentTab[]>;
  activeTabId: Record<string, string>;
  selectedRepo: string | null;
  selectedWorktreePath: string | null;
  leftPanelWidth: number;
  rightPanelWidth: number;
}

// Backend workspace config (from Rust)
export interface WorkspaceConfig {
  id: string;
  name: string;
  repo_path: string;
  worktree_path: string;
  branch: string;
  is_main_worktree: boolean;
  env_vars: Record<string, string>;
  port_base: number;
  status: "Active" | "Archived";
  created_at: string;
}

// Scripts / heroi.json config
export interface ScriptDef {
  name: string;
  command: string;
  args: string[];
  command_windows?: string;
  args_windows?: string[];
  cwd?: string;
}

export interface HeroiConfig {
  setup: ScriptDef[];
  run: ScriptDef[];
  archive: ScriptDef[];
  env: Record<string, string>;
}

export type ProcessStatus = "Running" | "Exited" | "Failed";

export interface RunningProcess {
  id: string;
  workspace_id: string;
  script_name: string;
  pid: number;
  status: ProcessStatus;
}

// GitHub / PR types
export interface PrInfo {
  number: number;
  title: string;
  state: string;
  url: string;
  head_branch: string;
  base_branch: string;
  draft: boolean;
  mergeable: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
}

export type MergeMethod = "Merge" | "Squash" | "Rebase";

// File browser types
export type FileType = "Code" | "Markdown" | "Image" | "Json" | "Config" | "Binary" | "Unknown";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  file_type: FileType;
}

export interface FileContent {
  path: string;
  content: string;
  file_type: FileType;
  size: number;
}

// Checkpoints
export interface Checkpoint {
  id: string;
  workspace_id: string;
  label: string;
  git_ref: string;
  created_at: string;
  file_count: number;
  agent_id: string | null;
}

// Legacy workspace format (for migration)
export interface LegacyWorkspace {
  id: string;
  name: string;
  repoPaths: string[];
  worktreeTabs: Record<string, AgentTab[]>;
  activeTabId: Record<string, string>;
  selectedRepo: string | null;
  selectedWorktreePath: string | null;
  leftPanelWidth: number;
  rightPanelWidth: number;
}
