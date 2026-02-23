import { X, ChevronDown, RotateCcw } from "lucide-react";
import { useWorkflowStore } from "../../stores/useWorkflowStore";
import { orchestrator } from "../../lib/workflowOrchestrator";
import { WorkflowCreator } from "./WorkflowCreator";
import { WorkflowProgress } from "./WorkflowProgress";
import { PlanningPhase } from "./PlanningPhase";
import { DevelopmentPhase } from "./DevelopmentPhase";
import { ReviewPhase } from "./ReviewPhase";
import { Button } from "../ui/Button";
import { useState } from "react";

function CompletedView() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl mb-2">&#10003;</div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">
          Workflow Complete
        </h3>
        <p className="text-xs text-zinc-500">
          All tasks have been processed. You can close this view or start a new
          workflow.
        </p>
      </div>
    </div>
  );
}

function StoppedView({
  phase,
  error,
  workflowId,
}: {
  phase: "failed" | "cancelled";
  error?: string;
  workflowId: string;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await orchestrator.retryPhase(workflowId);
    } catch (err) {
      console.error("Retry failed:", err);
    }
    setRetrying(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-2xl mb-2">
          {phase === "failed" ? "\u2717" : "\u25CB"}
        </div>
        <h3 className="text-sm font-semibold text-red-400 mb-1">
          Workflow {phase === "failed" ? "Failed" : "Cancelled"}
        </h3>
        {error && (
          <p className="text-xs text-zinc-500 mt-1 mb-3">{error}</p>
        )}
        <Button
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
          className="mt-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
        >
          <RotateCcw size={12} className={retrying ? "animate-spin" : ""} />
          {retrying ? "Retrying..." : "Retry from Previous Step"}
        </Button>
      </div>
    </div>
  );
}

export function WorkflowView() {
  const {
    workflows,
    activeWorkflowId,
    setActiveWorkflow,
    setShowWorkflowView,
  } = useWorkflowStore();
  const workflow = workflows.find((w) => w.id === activeWorkflowId);
  const [showPicker, setShowPicker] = useState(false);

  const handleClose = () => {
    setShowWorkflowView(false);
  };

  const handleNewWorkflow = () => {
    setActiveWorkflow(null);
    setShowPicker(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 shrink-0">
        {/* Workflow selector */}
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
          >
            <span className="font-medium truncate max-w-[200px]">
              {workflow?.name ?? "New Workflow"}
            </span>
            <ChevronDown size={12} className="text-zinc-500" />
          </button>

          {showPicker && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 min-w-[200px]">
              {workflows.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setActiveWorkflow(w.id);
                    setShowPicker(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors ${
                    w.id === activeWorkflowId
                      ? "text-indigo-400 bg-zinc-800"
                      : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                  }`}
                >
                  <span className="truncate">{w.name}</span>
                  <span
                    className={`text-[10px] ml-auto ${
                      w.phase === "completed"
                        ? "text-green-500"
                        : w.phase === "failed" || w.phase === "cancelled"
                          ? "text-red-500"
                          : "text-zinc-600"
                    }`}
                  >
                    {w.phase}
                  </span>
                </button>
              ))}
              <div className="border-t border-zinc-700 mt-1 pt-1">
                <button
                  onClick={handleNewWorkflow}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                >
                  + New Workflow
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Close button */}
        <Button variant="ghost" size="icon" onClick={handleClose} title="Close workflow view">
          <X size={14} />
        </Button>
      </div>

      {/* Content */}
      {!workflow ? (
        <WorkflowCreator />
      ) : (
        <>
          <WorkflowProgress workflow={workflow} />
          <div className="flex-1 flex flex-col min-h-0">
            {workflow.phase === "planning" && (
              <PlanningPhase workflow={workflow} />
            )}
            {workflow.phase === "developing" && (
              <DevelopmentPhase workflow={workflow} />
            )}
            {workflow.phase === "reviewing" && (
              <ReviewPhase workflow={workflow} />
            )}
            {workflow.phase === "completed" && <CompletedView />}
            {(workflow.phase === "failed" ||
              workflow.phase === "cancelled") && (
              <StoppedView
                phase={workflow.phase}
                error={workflow.error}
                workflowId={workflow.id}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
