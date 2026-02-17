import { GitCommitHorizontal, ArrowUpFromLine } from "lucide-react";

interface CommitSectionProps {
  commitMessage: string;
  onCommitMessageChange: (msg: string) => void;
  onCommit: () => void;
  onPush: () => void;
  aheadCount: number;
  hasStagedFiles: boolean;
}

export function CommitSection({
  commitMessage,
  onCommitMessageChange,
  onCommit,
  onPush,
  aheadCount,
  hasStagedFiles,
}: CommitSectionProps) {
  const canCommit = hasStagedFiles && commitMessage.trim().length > 0;

  return (
    <div className="px-2 py-2 border-b border-[var(--color-panel-border)]">
      <textarea
        value={commitMessage}
        onChange={(e) => onCommitMessageChange(e.target.value)}
        placeholder="Commit message..."
        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canCommit) {
            onCommit();
          }
        }}
      />
      <div className="flex items-center gap-1.5 mt-1.5">
        <button
          onClick={onCommit}
          disabled={!canCommit}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <GitCommitHorizontal size={12} />
          Commit
        </button>
        <button
          onClick={onPush}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
        >
          <ArrowUpFromLine size={12} />
          Push
          {aheadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-indigo-500/30 text-indigo-300">
              {aheadCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
