import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useAppStore } from "./stores/useAppStore";
import { listAgents, loadSettings } from "./lib/tauri";
import { DEFAULT_AGENTS } from "./lib/agents";
import { DEFAULT_SETTINGS } from "./lib/constants";

function App() {
  const setAgents = useAppStore((s) => s.setAgents);
  const setSettings = useAppStore((s) => s.setSettings);

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
  }, [setAgents, setSettings]);

  return <AppLayout />;
}

export default App;
