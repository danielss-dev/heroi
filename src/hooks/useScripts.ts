import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import {
  loadHeroiConfig,
  loadLocalScripts,
  saveLocalScripts,
  runScript,
  stopProcess,
  listRunningProcesses,
  getWorkspaceEnv,
} from "../lib/tauri";
import type { HeroiConfig, RunningProcess, ScriptDef } from "../types";

function isConfigEmpty(config: HeroiConfig): boolean {
  return (
    config.setup.length === 0 &&
    config.run.length === 0 &&
    config.archive.length === 0
  );
}

function mergeConfigs(
  repoConfig: HeroiConfig | null,
  localConfig: HeroiConfig | null
): HeroiConfig | null {
  // Repo config (heroi.json) takes priority
  if (repoConfig && !isConfigEmpty(repoConfig)) return repoConfig;
  if (localConfig && !isConfigEmpty(localConfig)) return localConfig;
  // Both empty/null — return whichever exists
  return repoConfig ?? localConfig;
}

export function useScripts() {
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const workspaces = useAppStore((s) => s.workspaces);
  const selectedWorktree = useAppStore((s) => s.selectedWorktree);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const [repoConfig, setRepoConfig] = useState<HeroiConfig | null>(null);
  const [localConfig, setLocalConfig] = useState<HeroiConfig | null>(null);
  const [processes, setProcesses] = useState<RunningProcess[]>([]);
  const [loading, setLoading] = useState(false);

  // Merged config: heroi.json takes priority over local scripts
  const config = useMemo(
    () => mergeConfigs(repoConfig, localConfig),
    [repoConfig, localConfig]
  );

  const hasRepoConfig =
    repoConfig !== null && !isConfigEmpty(repoConfig);

  // Load heroi.json config
  const loadConfig = useCallback(async () => {
    if (!selectedWorktree) {
      setRepoConfig(null);
      return;
    }
    try {
      const cfg = await loadHeroiConfig(selectedWorktree.path);
      setRepoConfig(cfg);
    } catch {
      setRepoConfig(null);
    }
  }, [selectedWorktree]);

  // Load local scripts
  const loadLocal = useCallback(async () => {
    if (!activeWorkspaceId) {
      setLocalConfig(null);
      return;
    }
    try {
      const cfg = await loadLocalScripts(activeWorkspaceId);
      setLocalConfig(cfg);
    } catch {
      setLocalConfig(null);
    }
  }, [activeWorkspaceId]);

  // Save local scripts
  const saveLocalConfig = useCallback(
    async (newConfig: HeroiConfig) => {
      if (!activeWorkspaceId) return;
      try {
        await saveLocalScripts(activeWorkspaceId, newConfig);
        setLocalConfig(newConfig);
      } catch (err) {
        console.error("Failed to save local scripts:", err);
      }
    },
    [activeWorkspaceId]
  );

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
    loadLocal();
  }, [loadLocal]);

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
        // Merge config env
        if (config?.env) {
          envVars = { ...envVars, ...config.env };
        }
        await runScript(
          activeWorkspaceId,
          script,
          selectedWorktree.path,
          envVars
        );
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

  const hasConfig =
    config !== null && !isConfigEmpty(config);

  return {
    config,
    localConfig,
    hasConfig,
    hasRepoConfig,
    processes,
    loading,
    activeWorkspace,
    loadConfig,
    loadLocal,
    saveLocalConfig,
    refreshProcesses,
    executeScript,
    killProcess,
  };
}
