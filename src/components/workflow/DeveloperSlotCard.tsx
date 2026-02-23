import {
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal,
  MessageCircleWarning,
} from "lucide-react";
import type { DeveloperSlot, WorkflowTask } from "../../types/workflow";
import { orchestrator } from "../../lib/workflowOrchestrator";

interface DeveloperSlotCardProps {
  developer: DeveloperSlot;
  task?: WorkflowTask;
  workflowId: string;
  index: number;
}

const statusConfig = {
  idle: { icon: Terminal, color: "text-zinc-500", label: "Idle" },
  working: {
    icon: Loader2,
    color: "text-indigo-400",
    label: "Working",
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: "text-green-400",
    label: "Done",
  },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
};

export function DeveloperSlotCard({
  developer,
  task,
  workflowId,
  index,
}: DeveloperSlotCardProps) {
  const config = statusConfig[developer.status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
            developer.status === "working"
              ? "bg-indigo-500/20 text-indigo-400"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {index + 1}
        </div>
        <span className="text-xs font-medium text-zinc-300 flex-1">
          Developer {index + 1}
        </span>
        <Icon
          size={14}
          className={`${config.color} ${"animate" in config && config.animate ? "animate-spin" : ""}`}
        />
        <span className={`text-[10px] ${config.color}`}>{config.label}</span>
      </div>

      {task && (
        <div className="pl-8">
          <div className="text-xs text-zinc-300 font-medium truncate">
            {task.title}
          </div>
          {task.branch && (
            <div className="text-[10px] text-zinc-600 mt-0.5 font-mono truncate">
              {task.branch}
            </div>
          )}
          {task.outputLog && (
            <div className="mt-2 p-2 rounded bg-zinc-950 border border-zinc-800 max-h-24 overflow-auto">
              <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap leading-relaxed font-mono">
                {task.outputLog.slice(-500)}
              </pre>
            </div>
          )}
          {task.pendingPrompt && (
            <div className="mt-2 p-2 rounded-md bg-amber-900/20 border border-amber-700/40">
              <div className="flex items-center gap-1.5 mb-1.5">
                <MessageCircleWarning size={12} className="text-amber-400 shrink-0" />
                <span className="text-[11px] text-amber-300 font-medium">
                  {task.pendingPrompt.message}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {task.pendingPrompt.options.map((option) => (
                  <button
                    key={option}
                    onClick={() =>
                      orchestrator.sendPromptResponse(workflowId, task.id, option)
                    }
                    className="px-2 py-0.5 text-[10px] font-medium rounded bg-amber-600/30 text-amber-200 hover:bg-amber-600/50 transition-colors border border-amber-600/40"
                  >
                    {option === "enter" ? "Press Enter" : option}
                  </button>
                ))}
              </div>
            </div>
          )}
          {task.error && (
            <div className="text-[10px] text-red-400 mt-1">{task.error}</div>
          )}
        </div>
      )}

      {!task && developer.status === "idle" && (
        <div className="pl-8 text-[11px] text-zinc-600">
          Waiting for task assignment...
        </div>
      )}
    </div>
  );
}
