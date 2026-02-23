import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { Orchestration } from "../../types/orchestrate";

const PHASES = [
  { id: "planning", label: "Plan" },
  { id: "developing", label: "Develop" },
  { id: "reviewing", label: "Review" },
  { id: "completed", label: "Done" },
] as const;

function phaseIndex(phase: string): number {
  const idx = PHASES.findIndex((p) => p.id === phase);
  return idx >= 0 ? idx : -1;
}

export function OrchestrateProgress({ orchestration }: { orchestration: Orchestration }) {
  const currentIdx = phaseIndex(orchestration.phase);
  const isFailed = orchestration.phase === "failed";
  const isCancelled = orchestration.phase === "cancelled";

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
      {PHASES.map((phase, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        const isError = isActive && (isFailed || isCancelled);

        return (
          <div key={phase.id} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`w-6 h-px ${
                  isDone ? "bg-green-500" : "bg-zinc-700"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                isError
                  ? "text-red-400 bg-red-900/20"
                  : isActive
                    ? "text-indigo-400 bg-indigo-500/10"
                    : isDone
                      ? "text-green-400"
                      : "text-zinc-600"
              }`}
            >
              {isDone ? (
                <CheckCircle2 size={12} />
              ) : isActive ? (
                isError ? (
                  <Circle size={12} />
                ) : (
                  <Loader2 size={12} className="animate-spin" />
                )
              ) : (
                <Circle size={12} />
              )}
              {phase.label}
            </div>
          </div>
        );
      })}

      {(isFailed || isCancelled) && (
        <span className="ml-auto text-xs text-red-400">
          {isFailed ? "Failed" : "Cancelled"}
          {orchestration.error && `: ${orchestration.error}`}
        </span>
      )}
    </div>
  );
}
