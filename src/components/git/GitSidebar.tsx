import { GitCommitHorizontal, RefreshCw } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useGitStatus } from "../../hooks/useGitStatus";
import { GitStatusList } from "./GitStatusList";
import { DiffPreview } from "./DiffPreview";

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
  } = useGitStatus(selectedWorktree?.path ?? null);

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel-bg)] border-l border-[var(--color-panel-border)]">
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
          <div className="overflow-y-auto border-b border-[var(--color-panel-border)]" style={{ maxHeight: "40%" }}>
            <GitStatusList
              files={files}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              onStage={stageFile}
              onUnstage={unstageFile}
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <DiffPreview diff={diff} loading={loading} />
          </div>
        </>
      )}
    </div>
  );
}
