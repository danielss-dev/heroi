import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../stores/useAppStore";
import {
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
  deleteCheckpoint,
} from "../lib/tauri";
import type { Checkpoint } from "../types";

export function useCheckpoints() {
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const selectedWorktree = useAppStore((s) => s.selectedWorktree);

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) {
      setCheckpoints([]);
      return;
    }
    try {
      const cps = await listCheckpoints(activeWorkspaceId);
      setCheckpoints(cps);
    } catch {
      setCheckpoints([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (label: string, agentId?: string) => {
      if (!activeWorkspaceId || !selectedWorktree) return;
      setLoading(true);
      try {
        await createCheckpoint(
          activeWorkspaceId,
          selectedWorktree.path,
          label,
          agentId
        );
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [activeWorkspaceId, selectedWorktree, refresh]
  );

  const restore = useCallback(
    async (gitRef: string) => {
      if (!selectedWorktree) return;
      setLoading(true);
      try {
        await restoreCheckpoint(selectedWorktree.path, gitRef);
      } finally {
        setLoading(false);
      }
    },
    [selectedWorktree]
  );

  const remove = useCallback(
    async (checkpointId: string) => {
      setLoading(true);
      try {
        await deleteCheckpoint(checkpointId);
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  return {
    checkpoints,
    loading,
    create,
    restore,
    remove,
    refresh,
  };
}
