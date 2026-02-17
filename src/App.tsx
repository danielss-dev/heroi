import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useAppStore } from "./stores/useAppStore";
import { listAgents, loadSettings, loadWorkspaces } from "./lib/tauri";
import { DEFAULT_AGENTS } from "./lib/agents";
import { DEFAULT_SETTINGS } from "./lib/constants";
import type { LegacyWorkspace, Workspace } from "./types";

/**
 * Migrate legacy workspaces (repoPaths: string[]) to new format
 * (repoPath: string + worktree binding).
 */
function migrateLegacyWorkspace(legacy: LegacyWorkspace): Workspace {
  const repoPath = legacy.repoPaths?.[0] ?? "";
  return {
    id: legacy.id,
    name: legacy.name,
    repoPath,
    worktreePath: legacy.selectedWorktreePath ?? repoPath,
    branch: "",
    isMainWorktree: true,
    portBase: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    envVars: {},
    worktreeTabs: legacy.worktreeTabs ?? {},
    activeTabId: legacy.activeTabId ?? {},
    selectedRepo: legacy.selectedRepo,
    selectedWorktreePath: legacy.selectedWorktreePath,
    leftPanelWidth: legacy.leftPanelWidth ?? 260,
    rightPanelWidth: legacy.rightPanelWidth ?? 300,
  };
}

function isLegacyWorkspace(ws: unknown): ws is LegacyWorkspace {
  return (
    typeof ws === "object" &&
    ws !== null &&
    "repoPaths" in ws &&
    Array.isArray((ws as LegacyWorkspace).repoPaths)
  );
}

function App() {
  const setAgents = useAppStore((s) => s.setAgents);
  const setSettings = useAppStore((s) => s.setSettings);
  const setWorkspaces = useAppStore((s) => s.setWorkspaces);
  const setActiveWorkspaceId = useAppStore((s) => s.setActiveWorkspaceId);

  useEffect(() => {
    listAgents()
      .then(setAgents)
      .catch(() => {
        setAgents(DEFAULT_AGENTS);
      });

    loadSettings()
      .then((stored) => {
        if (stored) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored });
        }
      })
      .catch(() => {
        // Use defaults on error
      });

    loadWorkspaces()
      .then((data) => {
        if (data.workspaces && data.workspaces.length > 0) {
          // Check if workspaces need migration from legacy format
          const workspaces = data.workspaces.map((ws) => {
            if (isLegacyWorkspace(ws)) {
              return migrateLegacyWorkspace(ws);
            }
            return ws as Workspace;
          });
          setWorkspaces(workspaces);
          setActiveWorkspaceId(data.activeWorkspaceId);

          // Auto-load the active workspace's state
          const activeId = data.activeWorkspaceId;
          if (activeId) {
            const activeWs = workspaces.find((w) => w.id === activeId);
            if (activeWs) {
              useAppStore.getState().loadWorkspaceState(activeWs);
            }
          }
        }
      })
      .catch(() => {
        // Will create default workspace from the UI
      });
  }, [setAgents, setSettings, setWorkspaces, setActiveWorkspaceId]);

  return <AppLayout />;
}

export default App;
