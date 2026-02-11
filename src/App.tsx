import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useAppStore } from "./stores/useAppStore";
import { listAgents } from "./lib/tauri";
import { DEFAULT_AGENTS } from "./lib/agents";

function App() {
  const setAgents = useAppStore((s) => s.setAgents);

  useEffect(() => {
    listAgents()
      .then(setAgents)
      .catch(() => {
        setAgents(DEFAULT_AGENTS);
      });
  }, [setAgents]);

  return <AppLayout />;
}

export default App;
