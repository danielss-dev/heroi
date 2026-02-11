import { useCallback, useEffect, useRef, useState } from "react";
import type { GitFileStatus, DiffOutput } from "../types";
import * as tauri from "../lib/tauri";
import { useAppStore } from "../stores/useAppStore";

export function useGitStatus(worktreePath: string | null) {
  const gitPollInterval = useAppStore((s) => s.settings.gitPollInterval);
  const [files, setFiles] = useState<GitFileStatus[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!worktreePath) {
      setFiles([]);
      return;
    }
    try {
      const status = await tauri.gitStatus(worktreePath);
      setFiles(status);
    } catch (err) {
      console.error("Failed to get git status:", err);
    }
  }, [worktreePath]);

  // Poll git status
  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, gitPollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, gitPollInterval]);

  // Load diff when file is selected
  useEffect(() => {
    if (!worktreePath || !selectedFile) {
      setDiff(null);
      return;
    }
    setLoading(true);
    tauri
      .gitDiffFile(worktreePath, selectedFile)
      .then(setDiff)
      .catch((err) => console.error("Failed to get diff:", err))
      .finally(() => setLoading(false));
  }, [worktreePath, selectedFile]);

  const stageFile = useCallback(
    async (filePath: string) => {
      if (!worktreePath) return;
      await tauri.gitStageFile(worktreePath, filePath);
      await refresh();
    },
    [worktreePath, refresh]
  );

  const unstageFile = useCallback(
    async (filePath: string) => {
      if (!worktreePath) return;
      await tauri.gitUnstageFile(worktreePath, filePath);
      await refresh();
    },
    [worktreePath, refresh]
  );

  return {
    files,
    selectedFile,
    setSelectedFile,
    diff,
    loading,
    refresh,
    stageFile,
    unstageFile,
  };
}
