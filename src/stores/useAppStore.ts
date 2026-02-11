import { create } from "zustand";
import type { RepoEntry, WorktreeInfo, AgentDef } from "../types";

interface AppState {
  repos: RepoEntry[];
  worktrees: Record<string, WorktreeInfo[]>; // keyed by repo path
  selectedRepo: string | null;
  selectedWorktree: WorktreeInfo | null;
  selectedAgentId: string;
  agents: AgentDef[];
  leftPanelWidth: number;
  rightPanelWidth: number;

  setRepos: (repos: RepoEntry[]) => void;
  addRepo: (repo: RepoEntry) => void;
  removeRepo: (path: string) => void;
  setWorktrees: (repoPath: string, worktrees: WorktreeInfo[]) => void;
  selectRepo: (path: string | null) => void;
  selectWorktree: (worktree: WorktreeInfo | null) => void;
  setAgents: (agents: AgentDef[]) => void;
  setSelectedAgentId: (id: string) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  repos: [],
  worktrees: {},
  selectedRepo: null,
  selectedWorktree: null,
  selectedAgentId: "shell",
  agents: [],
  leftPanelWidth: 260,
  rightPanelWidth: 300,

  setRepos: (repos) => set({ repos }),
  addRepo: (repo) => set((s) => ({ repos: [...s.repos, repo] })),
  removeRepo: (path) =>
    set((s) => ({
      repos: s.repos.filter((r) => r.path !== path),
      selectedRepo: s.selectedRepo === path ? null : s.selectedRepo,
    })),
  setWorktrees: (repoPath, worktrees) =>
    set((s) => ({ worktrees: { ...s.worktrees, [repoPath]: worktrees } })),
  selectRepo: (path) => set({ selectedRepo: path }),
  selectWorktree: (worktree) => set({ selectedWorktree: worktree }),
  setAgents: (agents) => set({ agents }),
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
}));
