import { Play, StopCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { TaskList } from "./TaskList";
import { DeveloperSlotCard } from "./DeveloperSlotCard";
import { useOrchestrateStore } from "../../stores/useOrchestrateStore";
import { engine } from "../../lib/orchestrateEngine";
import type { Orchestration } from "../../types/orchestrate";

export function DevelopmentPhase({ orchestration }: { orchestration: Orchestration }) {
  const { getOrchestrationProgress } = useOrchestrateStore();
  const progress = getOrchestrationProgress(orchestration.id);
  const devComplete = engine.isDevelopmentComplete(orchestration.id);

  const handleCancel = async () => {
    await engine.cancelOrchestration(orchestration.id);
  };

  const handleStartReview = async () => {
    await engine.startReview(orchestration.id);
  };

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: Developer slots */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-400">
              Developers ({orchestration.developers.length})
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">
                {progress.completed}/{progress.total}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!devComplete && (
              <Button variant="danger" size="sm" onClick={handleCancel}>
                <StopCircle size={12} />
                Cancel
              </Button>
            )}
            {devComplete && (
              <Button
                className="bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500"
                size="sm"
                onClick={handleStartReview}
              >
                <Play size={12} />
                Start Review
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <div className="flex flex-col gap-2">
            {orchestration.developers.map((dev, i) => {
              const task = orchestration.tasks.find((t) => t.id === dev.taskId);
              return (
                <DeveloperSlotCard
                  key={dev.id}
                  developer={dev}
                  task={task}
                  orchestrationId={orchestration.id}
                  index={i}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Task list (read-only) */}
      <div className="w-72 flex flex-col min-h-0 border-l border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center px-3 py-2 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400">
            All Tasks
          </span>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <TaskList
            orchestrationId={orchestration.id}
            tasks={orchestration.tasks}
            editable={false}
          />
        </div>
      </div>
    </div>
  );
}
