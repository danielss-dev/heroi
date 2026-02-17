import { useState, useEffect, useCallback } from "react";
import { GitCommitHorizontal, RefreshCw } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useGitStatus } from "../../hooks/useGitStatus";
import { gitDiffAll } from "../../lib/tauri";
import type { DiffOutput } from "../../types";
import { GitStatusList } from "./GitStatusList";
import { CommitSection } from "./CommitSection";
import { UnifiedDiff } from "../diff/UnifiedDiff";
import { PrPanel } from "../pr/PrPanel";
import { CheckpointTimeline } from "../checkpoints/CheckpointTimeline";
import { WorkspaceNotes } from "../workspace/WorkspaceNotes";

export function GitSidebar() {
  const { selectedWorktree } = useAppStore();
  const {
    files,
    selectedFile,
    setSelectedFile,
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
  } = useGitStatus(selectedWorktree?.path ?? null);

  // Diff data for all changed files
  const [diffs, setDiffs] = useState<DiffOutput[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

  const loadDiffs = useCallback(async () => {
    if (!selectedWorktree) return;
    setDiffLoading(true);
    try {
      const result = await gitDiffAll(selectedWorktree.path);
      setDiffs(result);
    } catch (err) {
      console.error("Failed to load diffs:", err);
    } finally {
      setDiffLoading(false);
    }
  }, [selectedWorktree]);

  useEffect(() => {
    loadDiffs();
  }, [selectedWorktree]);

  const handleRefresh = async () => {
    await Promise.all([refresh(), loadDiffs()]);
  };

  const stagedFiles = files.filter((f) => f.staged !== "Unmodified");
  const selectedDiff = diffs.find((d) => d.file_path === selectedFile);

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    try {
      await commit(commitMessage);
      loadDiffs();
    } catch (err) {
      console.error("Failed to commit:", err);
    }
  };

  const handlePush = async () => {
    try {
      await push();
    } catch (err) {
      console.error("Failed to push:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel-bg)]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-panel-border)]">
        <GitCommitHorizontal size={14} className="text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex-1">
          Git
        </span>
        <button
          onClick={handleRefresh}
          className="p-1 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={diffLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {!selectedWorktree ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-500 px-4 text-center">
            Select a worktree to view git changes
          </p>
        </div>
      ) : (
        <>
          <CommitSection
            commitMessage={commitMessage}
            onCommitMessageChange={setCommitMessage}
            onCommit={handleCommit}
            onPush={handlePush}
            aheadCount={aheadCount}
            hasStagedFiles={stagedFiles.length > 0}
          />

          <div
            className="overflow-y-auto border-b border-[var(--color-panel-border)]"
            style={{ maxHeight: "30%" }}
          >
            <GitStatusList
              files={files}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              onStage={stageFile}
              onUnstage={unstageFile}
              onStageAll={stageAll}
              onUnstageAll={unstageAll}
              worktreePath={selectedWorktree.path}
            />
          </div>

          {/* Diff Viewer */}
          <div className="flex-1 min-h-0 overflow-auto bg-[#09090b] border-b border-[var(--color-panel-border)]">
            {selectedDiff ? (
              <div className="flex flex-col h-full">
                <div className="px-3 py-1.5 border-b border-zinc-800 text-[11px] text-zinc-400 font-mono truncate shrink-0">
                  {selectedDiff.file_path}
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <UnifiedDiff
                    diffText={selectedDiff.diff_text}
                    filePath={selectedDiff.file_path}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-xs py-6">
                {files.length === 0
                  ? "No changes"
                  : "Select a file to view diff"}
              </div>
            )}
          </div>

          {/* Checkpoints */}
          <div className="border-t border-[var(--color-panel-border)] p-3">
            <CheckpointTimeline />
          </div>

          {/* Notes */}
          <div className="border-t border-[var(--color-panel-border)] p-3">
            <WorkspaceNotes />
          </div>

          {/* PR Section */}
          <div className="border-t border-[var(--color-panel-border)] p-3">
            <PrPanel />
          </div>
        </>
      )}
    </div>
  );
}
