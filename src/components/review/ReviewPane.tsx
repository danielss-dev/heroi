import { useCallback, useEffect, useMemo, useState } from "react";
import { GitCompare, RefreshCw, Send } from "lucide-react";
import type { Conversation, DiffOutput } from "../../types";
import { gitDiffBase } from "../../lib/tauri";
import { useReviewStore } from "../../stores/useReviewStore";
import { useAppStore } from "../../stores/useAppStore";
import { InlineCommentLayer } from "./InlineCommentLayer";
import { getAgentSupportsStructuredComments } from "../../lib/agents";

interface Props {
  conversation: Conversation;
}

export function ReviewPane({ conversation }: Props) {
  const [diffs, setDiffs] = useState<DiffOutput[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [shipBusy, setShipBusy] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);

  const loadComments = useReviewStore((s) => s.load);
  const ship = useReviewStore((s) => s.ship);
  const draftCount = useReviewStore((s) =>
    s.draftCount(conversation.id)
  );

  const settings = useAppStore((s) => s.settings);

  const loadDiffs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gitDiffBase(
        conversation.workingDir.path,
        conversation.workingDir.baseBranch
      );
      setDiffs(result);
      // Auto-pick a file if nothing selected or current selection is gone.
      setSelectedFile((prev) => {
        if (prev && result.some((d) => d.file_path === prev)) return prev;
        return result[0]?.file_path ?? null;
      });
    } catch (err) {
      console.error("Failed to load diff:", err);
    } finally {
      setLoading(false);
    }
  }, [conversation.workingDir.path, conversation.workingDir.baseBranch]);

  useEffect(() => {
    void loadDiffs();
    void loadComments(conversation.id);
  }, [conversation.id, loadDiffs, loadComments]);

  const selectedDiff = useMemo(
    () => diffs.find((d) => d.file_path === selectedFile) ?? null,
    [diffs, selectedFile]
  );

  const handleShip = async () => {
    if (draftCount === 0) return;
    setShipBusy(true);
    setShipError(null);
    try {
      const supportsStructured = getAgentSupportsStructuredComments(
        conversation.agentId,
        settings
      );
      await ship(
        conversation.id,
        supportsStructured ? "structured" : "synthesized"
      );
    } catch (err) {
      setShipError(typeof err === "string" ? err : (err as Error).message);
    } finally {
      setShipBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel-bg)]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-panel-border)] shrink-0">
        <GitCompare size={14} className="text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex-1">
          Review · {conversation.workingDir.baseBranch}
        </span>
        <button
          onClick={() => void loadDiffs()}
          className="p-1 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* File list */}
      <div
        className="overflow-y-auto border-b border-[var(--color-panel-border)] shrink-0"
        style={{ maxHeight: "30%" }}
      >
        {diffs.length === 0 ? (
          <div className="px-3 py-3 text-[11px] text-zinc-500">
            {loading
              ? "Loading diff…"
              : `No changes vs ${conversation.workingDir.baseBranch}.`}
          </div>
        ) : (
          diffs.map((d) => (
            <button
              key={d.file_path}
              onClick={() => setSelectedFile(d.file_path)}
              className={`w-full text-left px-3 py-1 text-xs font-mono truncate ${
                selectedFile === d.file_path
                  ? "bg-indigo-500/15 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/60"
              }`}
              title={d.file_path}
            >
              {d.file_path}
            </button>
          ))
        )}
      </div>

      {/* Diff + comments */}
      <div className="flex-1 min-h-0 overflow-auto bg-[#09090b]">
        {selectedDiff ? (
          <div className="flex flex-col">
            <div className="px-3 py-1.5 border-b border-zinc-800 text-[11px] text-zinc-400 font-mono truncate sticky top-0 bg-[#09090b] z-10">
              {selectedDiff.file_path}
            </div>
            <InlineCommentLayer
              conversationId={conversation.id}
              filePath={selectedDiff.file_path}
              diffText={selectedDiff.diff_text}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
            {loading ? "Loading…" : "Select a file"}
          </div>
        )}
      </div>

      {/* Ship footer */}
      <div className="border-t border-[var(--color-panel-border)] p-2 shrink-0 flex flex-col gap-1">
        {shipError && (
          <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-900 rounded px-2 py-1">
            {shipError}
          </div>
        )}
        <button
          onClick={handleShip}
          disabled={draftCount === 0 || shipBusy}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
        >
          <Send size={12} />
          {draftCount === 0
            ? "No drafts to send"
            : shipBusy
              ? "Sending…"
              : `Send ${draftCount} comment${draftCount === 1 ? "" : "s"} to agent`}
        </button>
        <div className="text-[10px] text-zinc-600 text-center">
          {getAgentSupportsStructuredComments(conversation.agentId, settings)
            ? "Structured tool call (Claude)"
            : "Synthesized prompt to agent stdin"}
        </div>
      </div>
    </div>
  );
}
