import { create } from "zustand";
import type {
  RepoEntry,
  WorktreeInfo,
  AgentDef,
  Settings,
  AgentTab,
  Workspace,
  WorkspaceConfig,
} from "../types";
import { DEFAULT_SETTINGS } from "../lib/constants";

export type RightPanel = "git" | "files" | "scripts";

interface AppState {
  repos: RepoEntry[];
  worktrees: Record<string, WorktreeInfo[]>;
  selectedRepo: string | null;
  selectedWorktree: WorktreeInfo | null;
  selectedAgentId: string;
  agents: AgentDef[];
  settings: Settings;
  leftPanelWidth: number;
  rightPanelWidth: number;
  rightPanel: RightPanel;

  // Tab state
  worktreeTabs: Record<string, AgentTab[]>;
  activeTabId: Record<string, string>;

  // Workspace state
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

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
  setRightPanel: (panel: RightPanel) => void;

  // Tab actions
  addTab: (worktreePath: string, agentId: string, label: string) => AgentTab;
  removeTab: (worktreePath: string, tabId: string) => void;
  setActiveTab: (worktreePath: string, tabId: string) => void;
  getTabsForWorktree: (worktreePath: string) => AgentTab[];
  getActiveTabForWorktree: (worktreePath: string) => AgentTab | undefined;

  // Workspace actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  addWorkspaceFromConfig: (config: WorkspaceConfig) => Workspace;
  switchWorkspace: (id: string) => void;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  saveCurrentWorkspace: () => void;
  loadWorkspaceState: (workspace: Workspace) => void;
}

function workspaceFromConfig(config: WorkspaceConfig): Workspace {
  return {
    id: config.id,
    name: config.name,
    repoPath: config.repo_path,
    worktreePath: config.worktree_path,
    branch: config.branch,
    isMainWorktree: config.is_main_worktree,
    portBase: config.port_base,
    status: config.status === "Active" ? "active" : "archived",
    createdAt: config.created_at,
    envVars: config.env_vars,
    worktreeTabs: {},
    activeTabId: {},
    selectedRepo: config.repo_path,
    selectedWorktreePath: config.worktree_path,
    leftPanelWidth: 260,
    rightPanelWidth: 300,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  repos: [],
  worktrees: {},
  selectedRepo: null,
  selectedWorktree: null,
  selectedAgentId: "shell",
  agents: [],
  settings: DEFAULT_SETTINGS,
  leftPanelWidth: 260,
  rightPanelWidth: 300,
  rightPanel: "git",

  worktreeTabs: {},
  activeTabId: {},

  workspaces: [],
  activeWorkspaceId: null,

  setRepos: (repos) => set({ repos }),
  addRepo: (repo) =>
    set((s) => {
      const newRepos = [...s.repos, repo];
      return { repos: newRepos };
    }),
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
  setRightPanel: (panel) => set({ rightPanel: panel }),

  // Tab actions
  addTab: (worktreePath, agentId, label) => {
    const tab: AgentTab = {
      id: crypto.randomUUID(),
      agentId,
      label,
      worktreePath,
    };
    set((s) => {
      const existing = s.worktreeTabs[worktreePath] ?? [];
      return {
        worktreeTabs: {
          ...s.worktreeTabs,
          [worktreePath]: [...existing, tab],
        },
        activeTabId: { ...s.activeTabId, [worktreePath]: tab.id },
        selectedAgentId: agentId,
      };
    });
    return tab;
  },

  removeTab: (worktreePath, tabId) =>
    set((s) => {
      const tabs = (s.worktreeTabs[worktreePath] ?? []).filter(
        (t) => t.id !== tabId
      );
      const newActiveTabId = { ...s.activeTabId };
      if (newActiveTabId[worktreePath] === tabId) {
        const last = tabs[tabs.length - 1];
        if (last) {
          newActiveTabId[worktreePath] = last.id;
        } else {
          delete newActiveTabId[worktreePath];
        }
      }
      const activeTab = tabs.find(
        (t) => t.id === newActiveTabId[worktreePath]
      );
      return {
        worktreeTabs: { ...s.worktreeTabs, [worktreePath]: tabs },
        activeTabId: newActiveTabId,
        selectedAgentId: activeTab?.agentId ?? s.selectedAgentId,
      };
    }),

  setActiveTab: (worktreePath, tabId) =>
    set((s) => {
      const tabs = s.worktreeTabs[worktreePath] ?? [];
      const tab = tabs.find((t) => t.id === tabId);
      return {
        activeTabId: { ...s.activeTabId, [worktreePath]: tabId },
        selectedAgentId: tab?.agentId ?? s.selectedAgentId,
      };
    }),

  getTabsForWorktree: (worktreePath) => {
    return get().worktreeTabs[worktreePath] ?? [];
  },

  getActiveTabForWorktree: (worktreePath) => {
    const state = get();
    const tabs = state.worktreeTabs[worktreePath] ?? [];
    const activeId = state.activeTabId[worktreePath];
    return tabs.find((t) => t.id === activeId);
  },

  // Workspace actions
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),

  addWorkspaceFromConfig: (config: WorkspaceConfig) => {
    const workspace = workspaceFromConfig(config);
    set((s) => ({
      workspaces: [...s.workspaces, workspace],
      activeWorkspaceId: workspace.id,
    }));
    return workspace;
  },

  switchWorkspace: (id) => {
    const state = get();
    // Save current workspace state first
    if (state.activeWorkspaceId) {
      state.saveCurrentWorkspace();
    }
    const workspace = get().workspaces.find((w) => w.id === id);
    if (!workspace) return;
    // Hide terminal sessions instead of destroying them (Phase 2 will improve this)
    window.dispatchEvent(new CustomEvent("heroi:destroy-all-sessions"));
    get().loadWorkspaceState(workspace);
    set({ activeWorkspaceId: id });
  },

  deleteWorkspace: (id) =>
    set((s) => {
      const workspaces = s.workspaces.filter((w) => w.id !== id);
      const activeWorkspaceId =
        s.activeWorkspaceId === id
          ? workspaces[0]?.id ?? null
          : s.activeWorkspaceId;
      return { workspaces, activeWorkspaceId };
    }),

  renameWorkspace: (id, name) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === id ? { ...w, name } : w
      ),
    })),

  saveCurrentWorkspace: () => {
    const state = get();
    if (!state.activeWorkspaceId) return;
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === s.activeWorkspaceId
          ? {
              ...w,
              worktreeTabs: s.worktreeTabs,
              activeTabId: s.activeTabId,
              selectedRepo: s.selectedRepo,
              selectedWorktreePath: s.selectedWorktree?.path ?? null,
              leftPanelWidth: s.leftPanelWidth,
              rightPanelWidth: s.rightPanelWidth,
            }
          : w
      ),
    }));
  },

  loadWorkspaceState: (workspace) => {
    // Set the selected worktree based on the workspace's bound worktree
    const worktreeInfo: WorktreeInfo = {
      name: workspace.isMainWorktree ? "main" : workspace.name,
      path: workspace.worktreePath,
      branch: workspace.branch,
      is_main: workspace.isMainWorktree,
    };

    set({
      worktreeTabs: workspace.worktreeTabs,
      activeTabId: workspace.activeTabId,
      selectedRepo: workspace.repoPath,
      selectedWorktree: worktreeInfo,
      leftPanelWidth: workspace.leftPanelWidth,
      rightPanelWidth: workspace.rightPanelWidth,
    });
  },
}));
