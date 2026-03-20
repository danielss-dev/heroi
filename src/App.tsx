import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useAppStore } from "./stores/useAppStore";
import { useOrchestrateStore } from "./stores/useOrchestrateStore";
import { loadSettings, loadWorkspaces } from "./lib/tauri";
import { buildAgents } from "./lib/agents";
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
    let cancelled = false;

    const initialize = async () => {
      try {
        const stored = await loadSettings();
        if (cancelled) return;

        const merged = stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
        setSettings(merged);
        setAgents(buildAgents(merged.defaultShell));
      } catch {
        if (cancelled) return;
        setSettings(DEFAULT_SETTINGS);
        setAgents(buildAgents(DEFAULT_SETTINGS.defaultShell));
      }

      try {
        const data = await loadWorkspaces();
        if (cancelled || !data.workspaces || data.workspaces.length === 0) return;

        const workspaces = data.workspaces.map((ws) => {
          if (isLegacyWorkspace(ws)) {
            return migrateLegacyWorkspace(ws);
          }
          return ws as Workspace;
        });

        setWorkspaces(workspaces);
        setActiveWorkspaceId(data.activeWorkspaceId);

        const activeId = data.activeWorkspaceId;
        if (activeId) {
          const activeWs = workspaces.find((w) => w.id === activeId);
          if (activeWs) {
            useAppStore.getState().loadWorkspaceState(activeWs);
          }
        }
      } catch {
        // The UI will create the first workspace on demand.
      }
    };

    useOrchestrateStore.getState().loadFromDisk();
    void initialize();

    return () => {
      cancelled = true;
    };
  }, [setAgents, setSettings, setWorkspaces, setActiveWorkspaceId]);

  return <AppLayout />;
}

export default App;
