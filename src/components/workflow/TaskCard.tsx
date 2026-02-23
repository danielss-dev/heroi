import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  GripVertical,
  Trash2,
  Pencil,
} from "lucide-react";
import type { WorkflowTask } from "../../types/workflow";

interface TaskCardProps {
  task: WorkflowTask;
  index: number;
  selected?: boolean;
  editable?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  onEdit?: (title: string, description: string) => void;
}

const statusConfig = {
  pending: { icon: Circle, color: "text-zinc-500", label: "Pending" },
  in_progress: {
    icon: Loader2,
    color: "text-indigo-400",
    label: "In Progress",
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: "text-green-400",
    label: "Completed",
  },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
  skipped: {
    icon: SkipForward,
    color: "text-zinc-500",
    label: "Skipped",
  },
};

const complexityColors = {
  small: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  large: "bg-red-500/20 text-red-400",
};

export function TaskCard({
  task,
  index,
  selected,
  editable,
  onSelect,
  onRemove,
  onEdit,
}: TaskCardProps) {
  const config = statusConfig[task.status];
  const Icon = config.icon;

  return (
    <div
      onClick={onSelect}
      className={`group flex items-start gap-2.5 px-3 py-2.5 rounded-md border transition-colors cursor-pointer ${
        selected
          ? "border-indigo-500/50 bg-indigo-500/5"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
    >
      {editable && (
        <GripVertical
          size={14}
          className="text-zinc-600 mt-0.5 shrink-0 cursor-grab"
        />
      )}

      <div className="flex items-center shrink-0 mt-0.5">
        <span className="text-[10px] text-zinc-600 w-5">{index + 1}</span>
        <Icon
          size={14}
          className={`${config.color} ${"animate" in config && config.animate ? "animate-spin" : ""}`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-200 truncate">
            {task.title}
          </span>
          {task.complexity && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${complexityColors[task.complexity]}`}
            >
              {task.complexity}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
            {task.description}
          </p>
        )}
        {task.error && (
          <p className="text-[11px] text-red-400 mt-1">{task.error}</p>
        )}
      </div>

      {editable && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newTitle = prompt("Task title:", task.title);
                if (newTitle) {
                  const newDesc = prompt(
                    "Task description:",
                    task.description
                  );
                  onEdit(newTitle, newDesc ?? task.description);
                }
              }}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800"
            >
              <Pencil size={11} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-800"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
