import { useState } from "react";
import { Play, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { TaskList } from "./TaskList";
import { useWorkflowStore } from "../../stores/useWorkflowStore";
import { orchestrator } from "../../lib/workflowOrchestrator";
import type { Workflow } from "../../types/workflow";

export function PlanningPhase({ workflow }: { workflow: Workflow }) {
  const planOutputBuffer = useWorkflowStore((s) => s.planOutputBuffer);
  const [starting, setStarting] = useState(false);

  const hasTasks = workflow.tasks.length > 0;
  const isRunning =
    !hasTasks && !workflow.error && workflow.startedAt !== undefined;

  const handleRetryPlan = async () => {
    setStarting(true);
    try {
      await orchestrator.startPlanning(workflow.id);
    } catch (err) {
      console.error("Failed to start planning:", err);
    }
    setStarting(false);
  };

  const handleStartDev = async () => {
    await orchestrator.startDevelopment(workflow.id);
  };

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: Terminal Output / Plan Log */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400">
            Plan Agent Output
          </span>
          {(workflow.error || hasTasks) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetryPlan}
              disabled={starting}
            >
              <RotateCcw size={12} />
              Retry
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-auto p-3 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed">
          {isRunning && !planOutputBuffer && (
            <div className="flex items-center gap-2 text-indigo-400">
              <Loader2 size={14} className="animate-spin" />
              Planning in progress...
            </div>
          )}
          {planOutputBuffer || (
            <span className="text-zinc-600">
              {workflow.startedAt
                ? "Waiting for output..."
                : "Plan will be generated when the workflow starts."}
            </span>
          )}
        </div>
      </div>

      {/* Right: Task List */}
      <div className="w-80 flex flex-col min-h-0 bg-zinc-900/30">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400">
            Implementation Plan
          </span>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <TaskList
            workflowId={workflow.id}
            tasks={workflow.tasks}
            editable={hasTasks}
          />
        </div>
        {hasTasks && (
          <div className="px-3 py-2 border-t border-zinc-800">
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500"
              size="sm"
              onClick={handleStartDev}
            >
              <Play size={12} />
              Start Development ({workflow.tasks.length} tasks)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
