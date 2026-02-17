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
  const [aheadCount, setAheadCount] = useState(0);
  const [commitMessage, setCommitMessage] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!worktreePath) {
      setFiles([]);
      setAheadCount(0);
      return;
    }
    try {
      const [status, ahead] = await Promise.all([
        tauri.gitStatus(worktreePath),
        tauri.gitAheadCount(worktreePath).catch(() => 0),
      ]);
      setFiles(status);
      setAheadCount(ahead);
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

  const stageAll = useCallback(async () => {
    if (!worktreePath) return;
    await tauri.gitStageAll(worktreePath);
    await refresh();
  }, [worktreePath, refresh]);

  const unstageAll = useCallback(async () => {
    if (!worktreePath) return;
    await tauri.gitUnstageAll(worktreePath);
    await refresh();
  }, [worktreePath, refresh]);

  const commit = useCallback(
    async (message: string) => {
      if (!worktreePath) return;
      await tauri.gitCommit(worktreePath, message);
      setCommitMessage("");
      await refresh();
    },
    [worktreePath, refresh]
  );

  const push = useCallback(async () => {
    if (!worktreePath) return;
    await tauri.gitPush(worktreePath);
    await refresh();
  }, [worktreePath, refresh]);

  return {
    files,
    selectedFile,
    setSelectedFile,
    diff,
    loading,
    refresh,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    commit,
    push,
    aheadCount,
    commitMessage,
    setCommitMessage,
  };
}
