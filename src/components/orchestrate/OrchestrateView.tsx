import { X, ChevronDown, RotateCcw } from "lucide-react";
import { useOrchestrateStore } from "../../stores/useOrchestrateStore";
import { engine } from "../../lib/orchestrateEngine";
import { OrchestrateCreator } from "./OrchestrateCreator";
import { OrchestrateProgress } from "./OrchestrateProgress";
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
          Orchestration Complete
        </h3>
        <p className="text-xs text-zinc-500">
          All tasks have been processed. You can close this view or start a new
          orchestration.
        </p>
      </div>
    </div>
  );
}

function StoppedView({
  phase,
  error,
  orchestrationId,
}: {
  phase: "failed" | "cancelled";
  error?: string;
  orchestrationId: string;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await engine.retryPhase(orchestrationId);
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
          Orchestration {phase === "failed" ? "Failed" : "Cancelled"}
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

export function OrchestrateView() {
  const {
    orchestrations,
    activeOrchestrationId,
    setActiveOrchestration,
    setShowOrchestrateView,
  } = useOrchestrateStore();
  const orchestration = orchestrations.find((o) => o.id === activeOrchestrationId);
  const [showPicker, setShowPicker] = useState(false);

  const handleClose = () => {
    setShowOrchestrateView(false);
  };

  const handleNewOrchestration = () => {
    setActiveOrchestration(null);
    setShowPicker(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 shrink-0">
        {/* Orchestration selector */}
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
          >
            <span className="font-medium truncate max-w-[200px]">
              {orchestration?.name ?? "New Orchestration"}
            </span>
            <ChevronDown size={12} className="text-zinc-500" />
          </button>

          {showPicker && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 min-w-[200px]">
              {orchestrations.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setActiveOrchestration(o.id);
                    setShowPicker(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors ${
                    o.id === activeOrchestrationId
                      ? "text-indigo-400 bg-zinc-800"
                      : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                  }`}
                >
                  <span className="truncate">{o.name}</span>
                  <span
                    className={`text-[10px] ml-auto ${
                      o.phase === "completed"
                        ? "text-green-500"
                        : o.phase === "failed" || o.phase === "cancelled"
                          ? "text-red-500"
                          : "text-zinc-600"
                    }`}
                  >
                    {o.phase}
                  </span>
                </button>
              ))}
              <div className="border-t border-zinc-700 mt-1 pt-1">
                <button
                  onClick={handleNewOrchestration}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                >
                  + New Orchestration
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Close button */}
        <Button variant="ghost" size="icon" onClick={handleClose} title="Close orchestrate view">
          <X size={14} />
        </Button>
      </div>

      {/* Content */}
      {!orchestration ? (
        <OrchestrateCreator />
      ) : (
        <>
          <OrchestrateProgress orchestration={orchestration} />
          <div className="flex-1 flex flex-col min-h-0">
            {orchestration.phase === "planning" && (
              <PlanningPhase orchestration={orchestration} />
            )}
            {orchestration.phase === "developing" && (
              <DevelopmentPhase orchestration={orchestration} />
            )}
            {orchestration.phase === "reviewing" && (
              <ReviewPhase orchestration={orchestration} />
            )}
            {orchestration.phase === "completed" && <CompletedView />}
            {(orchestration.phase === "failed" ||
              orchestration.phase === "cancelled") && (
              <StoppedView
                phase={orchestration.phase}
                error={orchestration.error}
                orchestrationId={orchestration.id}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
