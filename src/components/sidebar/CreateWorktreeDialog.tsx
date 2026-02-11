import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import type { BranchInfo } from "../../types";
import { listBranches, getDefaultBranch } from "../../lib/tauri";

interface CreateWorktreeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, branch?: string, baseBranch?: string) => Promise<unknown>;
  repoPath: string;
  repoName: string;
}

export function CreateWorktreeDialog({
  open,
  onClose,
  onSubmit,
  repoPath,
  repoName,
}: CreateWorktreeDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customBranch, setCustomBranch] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchPicker, setShowBranchPicker] = useState(false);

  // Load branches and default branch when dialog opens
  useEffect(() => {
    if (!open) return;
    setName("");
    setCustomBranch("");
    setBaseBranch("");
    setError(null);
    setShowAdvanced(false);
    setBranchSearch("");
    setShowBranchPicker(false);

    getDefaultBranch(repoPath)
      .then((b) => {
        setDefaultBranch(b);
        setBaseBranch(b);
      })
      .catch(() => setDefaultBranch("main"));

    listBranches(repoPath)
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [open, repoPath]);

  const filteredBranches = useMemo(() => {
    if (!branchSearch) return branches;
    const q = branchSearch.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchSearch]);

  const localBranches = filteredBranches.filter((b) => !b.is_remote);
  const remoteBranches = filteredBranches.filter((b) => b.is_remote);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const branchName = customBranch.trim() || undefined;
      const base = baseBranch || defaultBranch || undefined;
      await onSubmit(name.trim(), branchName, base);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`New Worktree — ${repoName}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            Worktree Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.replace(/\s+/g, "-"))}
            placeholder="feature-xyz"
            autoFocus
            className="w-full h-8 px-3 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="text-xs text-zinc-500">
          Base branch:{" "}
          <span className="text-zinc-300">{baseBranch || defaultBranch || "—"}</span>
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors self-start"
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${showAdvanced ? "rotate-0" : "-rotate-90"}`}
          />
          Advanced options
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-3 pl-2 border-l-2 border-zinc-800">
            {/* Custom branch name */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Branch Name{" "}
                <span className="text-zinc-600">(defaults to worktree name)</span>
              </label>
              <input
                type="text"
                value={customBranch}
                onChange={(e) =>
                  setCustomBranch(e.target.value.replace(/\s+/g, "-"))
                }
                placeholder={name || "Same as worktree name"}
                className="w-full h-8 px-3 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Base branch picker */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Base Branch
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBranchPicker(!showBranchPicker)}
                  className="flex items-center justify-between w-full h-8 px-3 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 hover:border-zinc-600 transition-colors"
                >
                  <span className="truncate">
                    {baseBranch || defaultBranch || "Select branch..."}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`shrink-0 text-zinc-500 transition-transform ${
                      showBranchPicker ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showBranchPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl max-h-56 flex flex-col">
                    {/* Search */}
                    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-zinc-800">
                      <Search size={12} className="text-zinc-500 shrink-0" />
                      <input
                        type="text"
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        placeholder="Filter branches..."
                        className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto">
                      {localBranches.length > 0 && (
                        <div>
                          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
                            Local
                          </div>
                          {localBranches.map((b) => (
                            <button
                              key={b.name}
                              type="button"
                              onClick={() => {
                                setBaseBranch(b.name);
                                setShowBranchPicker(false);
                                setBranchSearch("");
                              }}
                              className={`w-full text-left px-3 py-1 text-xs transition-colors ${
                                baseBranch === b.name
                                  ? "text-indigo-400 bg-zinc-800"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              {b.name}
                              {b.is_head && (
                                <span className="ml-1.5 text-[10px] text-zinc-500">
                                  HEAD
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {remoteBranches.length > 0 && (
                        <div>
                          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
                            Remote
                          </div>
                          {remoteBranches.map((b) => (
                            <button
                              key={b.name}
                              type="button"
                              onClick={() => {
                                setBaseBranch(b.name);
                                setShowBranchPicker(false);
                                setBranchSearch("");
                              }}
                              className={`w-full text-left px-3 py-1 text-xs transition-colors ${
                                baseBranch === b.name
                                  ? "text-indigo-400 bg-zinc-800"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {filteredBranches.length === 0 && (
                        <div className="px-3 py-2 text-xs text-zinc-600">
                          No branches found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1.5">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!name.trim() || loading}>
            {loading ? "Creating..." : "Create Worktree"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
