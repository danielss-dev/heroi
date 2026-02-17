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

export interface AgentArgsConfig {
  flags: Record<string, boolean>;
  extraArgs: string;
}

export interface Settings {
  defaultAgentId: string;
  gitPollInterval: number;
  defaultIde: IdeType;
  agentArgs: Record<string, AgentArgsConfig>;
}

export interface AgentTab {
  id: string;
  agentId: string;
  label: string;
  worktreePath: string;
}

export interface Workspace {
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
