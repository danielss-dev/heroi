import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useAppStore } from "./stores/useAppStore";
import { listAgents, loadSettings, loadWorkspaces } from "./lib/tauri";
import { DEFAULT_AGENTS } from "./lib/agents";
import { DEFAULT_SETTINGS } from "./lib/constants";

function App() {
  const setAgents = useAppStore((s) => s.setAgents);
  const setSettings = useAppStore((s) => s.setSettings);
  const setWorkspaces = useAppStore((s) => s.setWorkspaces);
  const setActiveWorkspaceId = useAppStore((s) => s.setActiveWorkspaceId);
  const repos = useAppStore((s) => s.repos);
  const createWorkspace = useAppStore((s) => s.createWorkspace);

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
          setWorkspaces(data.workspaces);
          setActiveWorkspaceId(data.activeWorkspaceId);
        }
      })
      .catch(() => {
        // Will create default workspace after repos load
      });
  }, [setAgents, setSettings, setWorkspaces, setActiveWorkspaceId]);

  // First-launch migration: create default workspace once repos are loaded
  useEffect(() => {
    const state = useAppStore.getState();
    if (state.workspaces.length === 0 && repos.length > 0) {
      const ws = createWorkspace("Default");
      // Update with existing repo paths
      useAppStore.setState((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === ws.id
            ? {
                ...w,
                repoPaths: repos.map((r) => r.path),
                leftPanelWidth: s.leftPanelWidth,
                rightPanelWidth: s.rightPanelWidth,
              }
            : w
        ),
      }));
    }
  }, [repos, createWorkspace]);

  return <AppLayout />;
}

export default App;
