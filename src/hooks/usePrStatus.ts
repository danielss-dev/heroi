import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../stores/useAppStore";
import {
  checkGhAvailable,
  getPrStatus,
  listPrChecks,
  createPr,
  mergePr,
} from "../lib/tauri";
import type { PrInfo, CheckRun, MergeMethod } from "../types";

export function usePrStatus() {
  const selectedWorktree = useAppStore((s) => s.selectedWorktree);

  const [ghAvailable, setGhAvailable] = useState<boolean | null>(null);
  const [pr, setPr] = useState<PrInfo | null>(null);
  const [checks, setChecks] = useState<CheckRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check gh availability
  useEffect(() => {
    checkGhAvailable()
      .then(setGhAvailable)
      .catch(() => setGhAvailable(false));
  }, []);

  const refreshPr = useCallback(async () => {
    if (!selectedWorktree || !ghAvailable) return;
    try {
      const info = await getPrStatus(selectedWorktree.path);
      setPr(info);
      const ch = await listPrChecks(selectedWorktree.path);
      setChecks(ch);
    } catch {
      setPr(null);
      setChecks([]);
    }
  }, [selectedWorktree, ghAvailable]);

  useEffect(() => {
    refreshPr();
  }, [refreshPr]);

  const handleCreatePr = useCallback(
    async (title: string, body: string, baseBranch?: string, draft?: boolean) => {
      if (!selectedWorktree) return;
      setLoading(true);
      setError(null);
      try {
        const info = await createPr(selectedWorktree.path, title, body, baseBranch, draft);
        setPr(info);
        await refreshPr();
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [selectedWorktree, refreshPr]
  );

  const handleMergePr = useCallback(
    async (method: MergeMethod, deleteBranch?: boolean) => {
      if (!selectedWorktree) return;
      setLoading(true);
      setError(null);
      try {
        await mergePr(selectedWorktree.path, method, deleteBranch);
        await refreshPr();
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [selectedWorktree, refreshPr]
  );

  return {
    ghAvailable,
    pr,
    checks,
    loading,
    error,
    refreshPr,
    createPr: handleCreatePr,
    mergePr: handleMergePr,
  };
}
