import { useCallback, useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import {
  saveWorkspaces,
  createWorkspaceWithWorktree,
  deleteWorkspaceWithWorktree,
  archiveWorkspace as archiveWsBackend,
  restoreWorkspace as restoreWsBackend,
} from "../lib/tauri";

export function useWorkspaceActions() {
  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);

  const persistWorkspaces = useCallback(async () => {
    const state = useAppStore.getState();
    try {
      await saveWorkspaces(state.workspaces, state.activeWorkspaceId);
    } catch (err) {
      console.error("Failed to persist workspaces:", err);
    }
  }, []);

  const createWorkspace = useCallback(
    async (
      repoPath: string,
      name: string,
      branch?: string,
      baseBranch?: string
    ) => {
      const config = await createWorkspaceWithWorktree(
        repoPath,
        name,
        branch,
        baseBranch
      );
      const workspace = useAppStore.getState().addWorkspaceFromConfig(config);
      useAppStore.getState().loadWorkspaceState(workspace);
      await persistWorkspaces();
    },
    [persistWorkspaces]
  );

  const switchWorkspace = useCallback(
    (id: string) => {
      if (id === activeWorkspaceId) return;
      useAppStore.getState().switchWorkspace(id);
      persistWorkspaces();
    },
    [activeWorkspaceId, persistWorkspaces]
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      const state = useAppStore.getState();
      if (state.workspaces.filter((w) => w.status === "active").length <= 1) return;
      try {
        await deleteWorkspaceWithWorktree(id);
      } catch (err) {
        console.error("Failed to delete worktree:", err);
      }
      state.deleteWorkspace(id);
      await persistWorkspaces();
    },
    [persistWorkspaces]
  );

  const archiveWorkspace = useCallback(
    async (id: string) => {
      try {
        await archiveWsBackend(id);
        // Remove the worktree from disk when archiving
        try {
          await deleteWorkspaceWithWorktree(id);
        } catch {
          // Worktree removal is best-effort
        }
        useAppStore.getState().archiveWorkspaceStatus(id);
        await persistWorkspaces();
      } catch (err) {
        console.error("Failed to archive:", err);
      }
    },
    [persistWorkspaces]
  );

  const restoreWorkspace = useCallback(
    async (id: string) => {
      try {
        await restoreWsBackend(id);
        useAppStore.getState().restoreWorkspaceStatus(id);
        await persistWorkspaces();
      } catch (err) {
        console.error("Failed to restore:", err);
      }
    },
    [persistWorkspaces]
  );

  const renameWorkspace = useCallback(
    (id: string, name: string) => {
      useAppStore.getState().renameWorkspace(id, name);
      persistWorkspaces();
    },
    [persistWorkspaces]
  );

  const getWorkspacesForRepo = useCallback(
    (repoPath: string) => workspaces.filter((w) => w.repoPath === repoPath),
    [workspaces]
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    persistWorkspaces,
    createWorkspace,
    switchWorkspace,
    deleteWorkspace,
    archiveWorkspace,
    restoreWorkspace,
    renameWorkspace,
    getWorkspacesForRepo,
  };
}
