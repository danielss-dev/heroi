import { useState, useEffect, useMemo, useRef } from "react";
import { Sparkles, ChevronDown, Search } from "lucide-react";
import { Button } from "../ui/Button";
import { useAppStore } from "../../stores/useAppStore";
import { useWorkflowStore } from "../../stores/useWorkflowStore";
import { orchestrator } from "../../lib/workflowOrchestrator";
import { listBranches, getDefaultBranch, createWorkspaceWithWorktree } from "../../lib/tauri";
import type { BranchInfo } from "../../types";

export function WorkflowCreator() {
  const repos = useAppStore((s) => s.repos);
  const agents = useAppStore((s) => s.agents);
  const activeWorkspace = useAppStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
    return ws;
  });

  const [name, setName] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [repoPath, setRepoPath] = useState(activeWorkspace?.repoPath ?? repos[0]?.path ?? "");
  const [baseBranch, setBaseBranch] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [planAgentId, setPlanAgentId] = useState("claude");
  const [devAgentId, setDevAgentId] = useState("claude");
  const [reviewAgentId, setReviewAgentId] = useState("claude");
  const [maxParallel, setMaxParallel] = useState(2);
  const [creating, setCreating] = useState(false);

  const branchPickerRef = useRef<HTMLDivElement>(null);

  const canCreate = name.trim() && featureDescription.trim() && repoPath;

  const agentOptions = agents.filter((a) => a.id !== "shell");

  // Load branches when repo changes
  useEffect(() => {
    if (!repoPath) return;

    setBranchSearch("");
    setShowBranchPicker(false);

    getDefaultBranch(repoPath)
      .then((b) => {
        setDefaultBranch(b);
        setBaseBranch(b);
      })
      .catch(() => {
        setDefaultBranch("main");
        setBaseBranch("main");
      });

    listBranches(repoPath)
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [repoPath]);

  // Close branch picker on outside click
  useEffect(() => {
    if (!showBranchPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (branchPickerRef.current && !branchPickerRef.current.contains(e.target as Node)) {
        setShowBranchPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showBranchPicker]);

  const filteredBranches = useMemo(() => {
    if (!branchSearch) return branches;
    const q = branchSearch.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchSearch]);

  const localBranches = filteredBranches.filter((b) => !b.is_remote);
  const remoteBranches = filteredBranches.filter((b) => b.is_remote);

  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);

    try {
      const store = useWorkflowStore.getState();
      const workflow = store.createWorkflow({
        name: name.trim(),
        repoPath,
        baseBranch: baseBranch || defaultBranch || "main",
        featureDescription: featureDescription.trim(),
        maxParallel,
        planAgentId,
        devAgentId,
        reviewAgentId,
      });

      // Create the workflow worktree + branch upfront
      const branchName = `wf/${name.trim().replace(/\s+/g, "-").toLowerCase()}`;
      const config = await createWorkspaceWithWorktree(
        repoPath,
        `wf-${workflow.id.slice(0, 8)}`,
        branchName,
        baseBranch || defaultBranch || "main"
      );

      store.updateWorkflow(workflow.id, {
        planWorktreePath: config.worktree_path,
        planWorkspaceId: config.id,
      });

      // Start planning in the workflow worktree
      await orchestrator.startPlanning(workflow.id);
    } catch (err) {
      setError(String(err));
      console.error("Failed to create workflow:", err);
    }

    setCreating(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Sparkles size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              New Workflow
            </h2>
            <p className="text-xs text-zinc-500">
              Describe a feature and let AI plan, build, and review it
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Workflow Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Add user authentication"
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Feature Description */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Feature Description
            </label>
            <textarea
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              placeholder="Describe the feature you want to build in detail..."
              rows={5}
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>

          {/* Repo + Branch */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">
                Repository
              </label>
              <select
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:border-indigo-500/50"
              >
                {repos.map((r) => (
                  <option key={r.path} value={r.path}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1" ref={branchPickerRef}>
              <label className="block text-xs text-zinc-400 mb-1">
                Base Branch
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBranchPicker(!showBranchPicker)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-zinc-600 transition-colors"
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

          {/* Agent Selection */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">
                Plan Agent
              </label>
              <select
                value={planAgentId}
                onChange={(e) => setPlanAgentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:border-indigo-500/50"
              >
                {agentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">
                Dev Agent
              </label>
              <select
                value={devAgentId}
                onChange={(e) => setDevAgentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:border-indigo-500/50"
              >
                {agentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">
                Review Agent
              </label>
              <select
                value={reviewAgentId}
                onChange={(e) => setReviewAgentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:border-indigo-500/50"
              >
                {agentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Parallel count */}
          <div className="w-40">
            <label className="block text-xs text-zinc-400 mb-1">
              Parallel Developers
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={maxParallel}
              onChange={(e) =>
                setMaxParallel(
                  Math.max(1, Math.min(5, parseInt(e.target.value) || 1))
                )
              }
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500"
            onClick={handleCreate}
            disabled={!canCreate || creating}
          >
            <Sparkles size={14} />
            {creating ? "Creating..." : "Create & Start Planning"}
          </Button>
        </div>
      </div>
    </div>
  );
}
