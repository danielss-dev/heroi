import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  XOctagon,
  MessageSquare,
  GitBranch,
} from "lucide-react";
import { Button } from "../ui/Button";
import { engine } from "../../lib/orchestrateEngine";
import type { Orchestration, ReviewComment } from "../../types/orchestrate";

const severityConfig = {
  suggestion: {
    icon: Lightbulb,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  blocker: {
    icon: XOctagon,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
};

function CommentItem({ comment }: { comment: ReviewComment }) {
  const config = severityConfig[comment.severity];
  const Icon = config.icon;

  return (
    <div className={`flex gap-2 p-2 rounded ${config.bg}`}>
      <Icon size={12} className={`${config.color} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {comment.file && (
          <div className="text-[10px] text-zinc-500 font-mono truncate">
            {comment.file}
            {comment.line ? `:${comment.line}` : ""}
          </div>
        )}
        <div className="text-[11px] text-zinc-300 mt-0.5">{comment.body}</div>
      </div>
    </div>
  );
}

export function ReviewPhase({ orchestration }: { orchestration: Orchestration }) {
  const review = orchestration.branchReview;
  const isInProgress = !review || review.status === "in_progress";

  const handleCleanup = async () => {
    await engine.cleanupWorktrees(orchestration.id);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400">
            Branch Review
          </span>
          <div className="flex items-center gap-1 text-[10px] text-zinc-600 font-mono">
            <GitBranch size={10} />
            vs {orchestration.baseBranch}
          </div>
          {isInProgress && (
            <div className="flex items-center gap-1.5 text-[10px] text-indigo-400">
              <Loader2 size={10} className="animate-spin" />
              Reviewing changes...
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleCleanup}>
          Cleanup Worktrees
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
          {isInProgress && (
            <div className="text-xs text-zinc-500 py-8 text-center">
              The review agent is analyzing all changes on this branch...
            </div>
          )}

          {review && review.status !== "in_progress" && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              {/* Review header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800">
                <span className="text-xs font-medium text-zinc-200 flex-1">
                  Overall Review
                </span>
                {review.status === "approved" ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                    <CheckCircle2 size={10} />
                    Approved
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
                    <AlertTriangle size={10} />
                    Changes Requested
                  </span>
                )}
                {review.comments.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <MessageSquare size={10} />
                    {review.comments.length}
                  </span>
                )}
              </div>

              {/* Summary */}
              {review.summary && (
                <div className="px-3 py-2 text-[11px] text-zinc-400 border-b border-zinc-800">
                  {review.summary}
                </div>
              )}

              {/* Comments */}
              {review.comments.length > 0 && (
                <div className="p-2 flex flex-col gap-1.5">
                  {review.comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))}
                </div>
              )}

              {review.comments.length === 0 && review.status === "approved" && (
                <div className="px-3 py-3 text-xs text-zinc-500 text-center">
                  No issues found. The implementation looks good.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
