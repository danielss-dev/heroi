import { useCallback, useEffect } from "react";
import { useAppStore } from "../stores/useAppStore";
import * as tauri from "../lib/tauri";

export function useRepos() {
  const { repos, setRepos, addRepo, removeRepo, setWorktrees } = useAppStore();

  const loadRepos = useCallback(async () => {
    try {
      const list = await tauri.listRepos();
      setRepos(list);
    } catch (err) {
      console.error("Failed to load repos:", err);
    }
  }, [setRepos]);

  const handleAddRepo = useCallback(
    async (path: string) => {
      try {
        const entry = await tauri.addRepo(path);
        addRepo(entry);
        // Load worktrees for the new repo
        const wts = await tauri.listWorktrees(path);
        setWorktrees(path, wts);
        return entry;
      } catch (err) {
        console.error("Failed to add repo:", err);
        throw err;
      }
    },
    [addRepo, setWorktrees]
  );

  const handleRemoveRepo = useCallback(
    async (path: string) => {
      try {
        await tauri.removeRepo(path);
        removeRepo(path);
      } catch (err) {
        console.error("Failed to remove repo:", err);
        throw err;
      }
    },
    [removeRepo]
  );

  const loadWorktrees = useCallback(
    async (repoPath: string) => {
      try {
        const wts = await tauri.listWorktrees(repoPath);
        setWorktrees(repoPath, wts);
        return wts;
      } catch (err) {
        console.error("Failed to load worktrees:", err);
        throw err;
      }
    },
    [setWorktrees]
  );

  const handleCreateWorktree = useCallback(
    async (repoPath: string, name: string, branch?: string, baseBranch?: string) => {
      try {
        const wt = await tauri.createWorktree(repoPath, name, branch, baseBranch);
        await loadWorktrees(repoPath);
        return wt;
      } catch (err) {
        console.error("Failed to create worktree:", err);
        throw err;
      }
    },
    [loadWorktrees]
  );

  const handleRemoveWorktree = useCallback(
    async (repoPath: string, worktreePath: string) => {
      try {
        await tauri.removeWorktree(repoPath, worktreePath);
        // Reload worktrees
        await loadWorktrees(repoPath);
      } catch (err) {
        console.error("Failed to remove worktree:", err);
        throw err;
      }
    },
    [loadWorktrees]
  );

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  return {
    repos,
    loadRepos,
    addRepo: handleAddRepo,
    removeRepo: handleRemoveRepo,
    loadWorktrees,
    createWorktree: handleCreateWorktree,
    removeWorktree: handleRemoveWorktree,
  };
}
