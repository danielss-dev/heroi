import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useAppStore } from "./stores/useAppStore";
import { useOrchestrateStore } from "./stores/useOrchestrateStore";
import { useProjectStore } from "./stores/useProjectStore";
import { useConversationStore } from "./stores/useConversationStore";
import { loadSettings, loadWorkspaces } from "./lib/tauri";
import { buildAgents } from "./lib/agents";
import { DEFAULT_SETTINGS } from "./lib/constants";
import { runMigration } from "./lib/migration";
import { subscribeMcpEvents } from "./lib/mcpClient";
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
      let activeSettings = DEFAULT_SETTINGS;
      try {
        const stored = await loadSettings();
        if (cancelled) return;

        const merged = stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
        activeSettings = merged;
        setSettings(merged);
        setAgents(buildAgents(merged.defaultShell));
      } catch {
        if (cancelled) return;
        setSettings(DEFAULT_SETTINGS);
        setAgents(buildAgents(DEFAULT_SETTINGS.defaultShell));
      }

      try {
        const report = await runMigration(activeSettings);
        if (!report.alreadyMigrated) {
          console.info(
            `[heroi] migrated to schema v${report.schemaVersionAfter}: ` +
              `${report.projectsWritten} projects, ${report.conversationsWritten} conversations`
          );
        }
      } catch (err) {
        console.error("[heroi] migration failed; continuing on legacy data", err);
      }

      try {
        await Promise.all([
          useProjectStore.getState().refresh(),
          useConversationStore.getState().refresh(),
        ]);
      } catch (err) {
        console.error("[heroi] failed to load projects/conversations", err);
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

    let unlisten: (() => void) | null = null;
    void subscribeMcpEvents().then((u) => {
      if (cancelled) {
        u();
      } else {
        unlisten = u;
      }
    });

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [setAgents, setSettings, setWorkspaces, setActiveWorkspaceId]);

  return <AppLayout />;
}

export default App;
