import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../stores/useAppStore";
import {
  loadHeroiConfig,
  runScript,
  stopProcess,
  listRunningProcesses,
  getWorkspaceEnv,
} from "../lib/tauri";
import type { HeroiConfig, RunningProcess, ScriptDef } from "../types";

export function useScripts() {
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const workspaces = useAppStore((s) => s.workspaces);
  const selectedWorktree = useAppStore((s) => s.selectedWorktree);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const [config, setConfig] = useState<HeroiConfig | null>(null);
  const [processes, setProcesses] = useState<RunningProcess[]>([]);
  const [loading, setLoading] = useState(false);

  // Load heroi.json config
  const loadConfig = useCallback(async () => {
    if (!selectedWorktree) {
      setConfig(null);
      return;
    }
    try {
      const cfg = await loadHeroiConfig(selectedWorktree.path);
      setConfig(cfg);
    } catch {
      setConfig(null);
    }
  }, [selectedWorktree]);

  // Refresh running processes
  const refreshProcesses = useCallback(async () => {
    if (!activeWorkspaceId) {
      setProcesses([]);
      return;
    }
    try {
      const procs = await listRunningProcesses(activeWorkspaceId);
      setProcesses(procs);
    } catch {
      setProcesses([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    refreshProcesses();
    const interval = setInterval(refreshProcesses, 3000);
    return () => clearInterval(interval);
  }, [refreshProcesses]);

  const executeScript = useCallback(
    async (script: ScriptDef) => {
      if (!activeWorkspaceId || !selectedWorktree) return;
      setLoading(true);
      try {
        // Get workspace env vars to inject
        let envVars: Record<string, string> = {};
        try {
          envVars = await getWorkspaceEnv(activeWorkspaceId);
        } catch {
          // use config env as fallback
        }
        // Merge heroi.json env
        if (config?.env) {
          envVars = { ...envVars, ...config.env };
        }
        await runScript(activeWorkspaceId, script, selectedWorktree.path, envVars);
        await refreshProcesses();
      } finally {
        setLoading(false);
      }
    },
    [activeWorkspaceId, selectedWorktree, config, refreshProcesses]
  );

  const killProcess = useCallback(
    async (processId: string) => {
      try {
        await stopProcess(processId);
        await refreshProcesses();
      } catch (err) {
        console.error("Failed to stop process:", err);
      }
    },
    [refreshProcesses]
  );

  const hasConfig = config !== null && (config.setup.length > 0 || config.run.length > 0 || config.archive.length > 0);

  return {
    config,
    processes,
    loading,
    hasConfig,
    activeWorkspace,
    loadConfig,
    refreshProcesses,
    executeScript,
    killProcess,
  };
}
