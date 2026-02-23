import {
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import type { OrchestrateTask, ReviewComment } from "../../types/orchestrate";

interface ReviewCardProps {
  task: OrchestrateTask;
  selected?: boolean;
  onToggleMerge?: (checked: boolean) => void;
  mergeChecked?: boolean;
}

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

export function ReviewCard({
  task,
  onToggleMerge,
  mergeChecked,
}: ReviewCardProps) {
  const review = task.review;
  if (!review) return null;

  const isApproved = review.status === "approved";
  const commentCount = review.comments.length;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        {onToggleMerge && (
          <input
            type="checkbox"
            checked={mergeChecked}
            onChange={(e) => onToggleMerge(e.target.checked)}
            className="accent-indigo-500"
          />
        )}
        <span className="text-xs font-medium text-zinc-200 flex-1 truncate">
          {task.title}
        </span>
        {isApproved ? (
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
        {commentCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
            <MessageSquare size={10} />
            {commentCount}
          </span>
        )}
      </div>

      {review.summary && (
        <div className="px-3 py-2 text-[11px] text-zinc-400 border-b border-zinc-800">
          {review.summary}
        </div>
      )}

      {review.comments.length > 0 && (
        <div className="p-2 flex flex-col gap-1.5">
          {review.comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {task.branch && (
        <div className="px-3 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-600 font-mono">
          Branch: {task.branch}
        </div>
      )}
    </div>
  );
}
