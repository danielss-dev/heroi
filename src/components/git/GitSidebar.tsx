import { GitCommitHorizontal, RefreshCw } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useGitStatus } from "../../hooks/useGitStatus";
import { GitStatusList } from "./GitStatusList";
import { CommitSection } from "./CommitSection";
import { DiffPreview } from "./DiffPreview";
import { PrPanel } from "../pr/PrPanel";
import { CheckpointTimeline } from "../checkpoints/CheckpointTimeline";
import { WorkspaceNotes } from "../workspace/WorkspaceNotes";

export function GitSidebar() {
  const { selectedWorktree } = useAppStore();
  const {
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
  } = useGitStatus(selectedWorktree?.path ?? null);

  const stagedFiles = files.filter((f) => f.staged !== "Unmodified");

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    try {
      await commit(commitMessage);
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
          Git Changes
        </span>
        <button
          onClick={refresh}
          className="p-1 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} />
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
            style={{ maxHeight: "40%" }}
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

          <div className="flex-1 overflow-y-auto min-h-0">
            <DiffPreview diff={diff} loading={loading} />
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
