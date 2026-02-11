import { create } from "zustand";
import type { RepoEntry, WorktreeInfo, AgentDef, Settings } from "../types";
import { DEFAULT_SETTINGS } from "../lib/constants";

interface AppState {
  repos: RepoEntry[];
  worktrees: Record<string, WorktreeInfo[]>; // keyed by repo path
  selectedRepo: string | null;
  selectedWorktree: WorktreeInfo | null;
  selectedAgentId: string;
  agents: AgentDef[];
  settings: Settings;
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
  setSettings: (settings: Settings) => void;
  updateSettings: (partial: Partial<Settings>) => void;
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
  settings: DEFAULT_SETTINGS,
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
  setSettings: (settings) =>
    set({ settings, selectedAgentId: settings.defaultAgentId }),
  updateSettings: (partial) =>
    set((s) => {
      const settings = { ...s.settings, ...partial };
      return {
        settings,
        selectedAgentId: partial.defaultAgentId ?? s.selectedAgentId,
      };
    }),
  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
}));
