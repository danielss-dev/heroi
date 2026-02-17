import { useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  GitMerge,
  Check,
  X,
  Loader2,
  Circle,
} from "lucide-react";
import { Button } from "../ui/Button";
import { PrStatusBadge } from "./PrStatusBadge";
import { usePrStatus } from "../../hooks/usePrStatus";
import { useAppStore } from "../../stores/useAppStore";
import type { MergeMethod } from "../../types";

export function PrPanel() {
  const { ghAvailable, pr, checks, loading, error, refreshPr, createPr, mergePr } =
    usePrStatus();
  const selectedWorktree = useAppStore((s) => s.selectedWorktree);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);

  if (!ghAvailable) {
    return (
      <div className="p-3 text-xs text-zinc-500">
        GitHub CLI (<span className="font-mono">gh</span>) is not installed or
        not authenticated.
      </div>
    );
  }

  if (!selectedWorktree) {
    return (
      <div className="p-3 text-xs text-zinc-500">
        Select a worktree to view PR status.
      </div>
    );
  }

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createPr(title.trim(), body.trim(), undefined, draft);
    setShowCreate(false);
    setTitle("");
    setBody("");
    setDraft(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300">
          Pull Request
        </span>
        <button
          onClick={refreshPr}
          className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {error && (
        <p className="text-[10px] text-red-400 bg-red-900/20 rounded px-2 py-1">
          {error}
        </p>
      )}

      {pr ? (
        <div className="space-y-2">
          {/* PR info */}
          <div className="flex items-start gap-2">
            <PrStatusBadge state={pr.state} draft={pr.draft} number={pr.number} />
            <a
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 truncate"
              title={pr.url}
            >
              <ExternalLink size={10} className="shrink-0" />
              <span className="truncate">{pr.title}</span>
            </a>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span className="text-green-400">+{pr.additions}</span>
            <span className="text-red-400">-{pr.deletions}</span>
            <span>{pr.changed_files} files</span>
          </div>

          {/* Checks */}
          {checks.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
                Checks
              </div>
              {checks.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {c.conclusion === "SUCCESS" || c.conclusion === "success" ? (
                    <Check size={10} className="text-green-400 shrink-0" />
                  ) : c.conclusion === "FAILURE" || c.conclusion === "failure" ? (
                    <X size={10} className="text-red-400 shrink-0" />
                  ) : c.status === "IN_PROGRESS" || c.status === "in_progress" ? (
                    <Loader2
                      size={10}
                      className="text-yellow-400 animate-spin shrink-0"
                    />
                  ) : (
                    <Circle size={10} className="text-zinc-600 shrink-0" />
                  )}
                  <span className="text-zinc-400 truncate">{c.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Merge button */}
          {pr.state === "OPEN" && (
            <div className="pt-1">
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 w-full"
                disabled={loading}
                onClick={() => mergePr("Squash" as MergeMethod)}
              >
                <GitMerge size={11} />
                {loading ? "Merging..." : "Squash & Merge"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {showCreate ? (
            <div className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="PR title..."
                className="w-full h-7 px-2 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Description (optional)..."
                rows={3}
                className="w-full px-2 py-1.5 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft}
                  onChange={(e) => setDraft(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                Create as draft
              </label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  disabled={!title.trim() || loading}
                  onClick={handleCreate}
                >
                  {loading ? "Creating..." : "Create PR"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowCreate(true)}
            >
              Create Pull Request
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
