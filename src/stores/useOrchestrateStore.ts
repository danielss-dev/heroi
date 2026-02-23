import { create } from "zustand";
import type {
  Orchestration,
  OrchestrateTask,
  DeveloperSlot,
  OrchestratePhase,
  TaskReview,
} from "../types/orchestrate";
import { saveOrchestrations, loadOrchestrations } from "../lib/tauri";

interface OrchestrateState {
  orchestrations: Orchestration[];
  activeOrchestrationId: string | null;
  planOutputBuffer: string;
  selectedTaskId: string | null;
  showOrchestrateView: boolean;

  // Persistence
  loadFromDisk: () => Promise<void>;

  // CRUD
  createOrchestration: (params: {
    name: string;
    repoPath: string;
    baseBranch: string;
    featureDescription: string;
    maxParallel: number;
    planAgentId: string;
    devAgentId: string;
    reviewAgentId: string;
  }) => Orchestration;
  updateOrchestration: (id: string, updates: Partial<Orchestration>) => void;
  deleteOrchestration: (id: string) => void;
  setActiveOrchestration: (id: string | null) => void;

  // Phase transitions
  setPhase: (orchestrationId: string, phase: OrchestratePhase) => void;

  // Task management
  setTasks: (orchestrationId: string, tasks: OrchestrateTask[]) => void;
  updateTask: (
    orchestrationId: string,
    taskId: string,
    updates: Partial<OrchestrateTask>
  ) => void;
  removeTask: (orchestrationId: string, taskId: string) => void;
  reorderTasks: (orchestrationId: string, taskIds: string[]) => void;

  // Developer slot management
  setDevelopers: (orchestrationId: string, developers: DeveloperSlot[]) => void;
  updateDeveloper: (
    orchestrationId: string,
    devId: string,
    updates: Partial<DeveloperSlot>
  ) => void;

  // Task review
  setTaskReview: (
    orchestrationId: string,
    taskId: string,
    review: TaskReview
  ) => void;

  // Planning output
  appendPlanOutput: (text: string) => void;
  clearPlanOutput: () => void;

  // UI
  setSelectedTask: (taskId: string | null) => void;
  setShowOrchestrateView: (show: boolean) => void;

  // Derived getters
  getActiveOrchestration: () => Orchestration | undefined;
  getNextPendingTask: (orchestrationId: string) => OrchestrateTask | undefined;
  getOrchestrationProgress: (orchestrationId: string) => {
    completed: number;
    total: number;
    percent: number;
  };
}

function updateOrchestrationInList(
  orchestrations: Orchestration[],
  id: string,
  updater: (o: Orchestration) => Orchestration
): Orchestration[] {
  return orchestrations.map((o) => (o.id === id ? updater(o) : o));
}

/** Strip transient/large data before persisting orchestrations */
function prepareForPersistence(orchestrations: Orchestration[]): unknown[] {
  return orchestrations.map((o) => ({
    ...o,
    // Strip outputLog and pendingPrompt from tasks (transient terminal data)
    tasks: o.tasks.map((t) => ({
      ...t,
      outputLog: "",
      pendingPrompt: undefined,
    })),
    // Clear developer slots (terminal sessions don't survive restart)
    developers: [],
    // Cap planOutput for storage
    planOutput: o.planOutput ? o.planOutput.slice(-3000) : undefined,
    // Cap devSummaries outputSnippet for storage
    devSummaries: o.devSummaries?.map((s) => ({
      ...s,
      outputSnippet: s.outputSnippet.slice(-500),
    })),
    // Strip envSnapshot (contains API keys, should not persist to disk)
    envSnapshot: undefined,
  }));
}

// Debounced save — avoids hammering the store during rapid output updates
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { orchestrations, activeOrchestrationId } = useOrchestrateStore.getState();
    const data = prepareForPersistence(orchestrations);
    saveOrchestrations(data, activeOrchestrationId).catch(() => {
      /* ignore save errors */
    });
  }, 1000);
}

export const useOrchestrateStore = create<OrchestrateState>((set, get) => ({
  orchestrations: [],
  activeOrchestrationId: null,
  planOutputBuffer: "",
  selectedTaskId: null,
  showOrchestrateView: false,

  loadFromDisk: async () => {
    try {
      const data = await loadOrchestrations();
      if (data.workflows && Array.isArray(data.workflows) && data.workflows.length > 0) {
        set({
          orchestrations: data.workflows as Orchestration[],
          activeOrchestrationId: data.activeWorkflowId,
        });
      }
    } catch {
      // No saved orchestrations
    }
  },

  createOrchestration: (params) => {
    const orchestration: Orchestration = {
      id: crypto.randomUUID(),
      name: params.name,
      repoPath: params.repoPath,
      baseBranch: params.baseBranch,
      featureDescription: params.featureDescription,
      phase: "planning",
      tasks: [],
      developers: [],
      maxParallel: params.maxParallel,
      planAgentId: params.planAgentId,
      devAgentId: params.devAgentId,
      reviewAgentId: params.reviewAgentId,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      orchestrations: [...s.orchestrations, orchestration],
      activeOrchestrationId: orchestration.id,
      showOrchestrateView: true,
    }));
    scheduleSave();
    return orchestration;
  },

  updateOrchestration: (id, updates) => {
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, id, (o) => ({
        ...o,
        ...updates,
      })),
    }));
    scheduleSave();
  },

  deleteOrchestration: (id) => {
    set((s) => ({
      orchestrations: s.orchestrations.filter((o) => o.id !== id),
      activeOrchestrationId:
        s.activeOrchestrationId === id ? null : s.activeOrchestrationId,
    }));
    scheduleSave();
  },

  setActiveOrchestration: (id) => {
    set({ activeOrchestrationId: id });
    scheduleSave();
  },

  setPhase: (orchestrationId, phase) => {
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, orchestrationId, (o) => ({
        ...o,
        phase,
        ...(phase === "completed" || phase === "failed" || phase === "cancelled"
          ? { completedAt: new Date().toISOString() }
          : {}),
      })),
    }));
    scheduleSave();
  },

  setTasks: (orchestrationId, tasks) => {
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, orchestrationId, (o) => ({
        ...o,
        tasks,
      })),
    }));
    scheduleSave();
  },

  updateTask: (orchestrationId, taskId, updates) =>
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, orchestrationId, (o) => ({
        ...o,
        tasks: o.tasks.map((t) =>
          t.id === taskId ? { ...t, ...updates } : t
        ),
      })),
    })),
    // NOTE: updateTask is called very frequently (terminal output), so we
    // do NOT scheduleSave here — save is triggered by phase/task status changes

  removeTask: (orchestrationId, taskId) => {
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, orchestrationId, (o) => ({
        ...o,
        tasks: o.tasks.filter((t) => t.id !== taskId),
      })),
    }));
    scheduleSave();
  },

  reorderTasks: (orchestrationId, taskIds) => {
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, orchestrationId, (o) => {
        const taskMap = new Map(o.tasks.map((t) => [t.id, t]));
        const reordered = taskIds
          .map((id) => taskMap.get(id))
          .filter((t): t is OrchestrateTask => t !== undefined);
        return { ...o, tasks: reordered };
      }),
    }));
    scheduleSave();
  },

  setDevelopers: (orchestrationId, developers) => {
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, orchestrationId, (o) => ({
        ...o,
        developers,
      })),
    }));
    scheduleSave();
  },

  updateDeveloper: (orchestrationId, devId, updates) =>
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, orchestrationId, (o) => ({
        ...o,
        developers: o.developers.map((d) =>
          d.id === devId ? { ...d, ...updates } : d
        ),
      })),
    })),

  setTaskReview: (orchestrationId, taskId, review) => {
    set((s) => ({
      orchestrations: updateOrchestrationInList(s.orchestrations, orchestrationId, (o) => ({
        ...o,
        tasks: o.tasks.map((t) =>
          t.id === taskId ? { ...t, review } : t
        ),
      })),
    }));
    scheduleSave();
  },

  appendPlanOutput: (text) =>
    set((s) => ({ planOutputBuffer: s.planOutputBuffer + text })),

  clearPlanOutput: () => set({ planOutputBuffer: "" }),

  setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),
  setShowOrchestrateView: (show) => set({ showOrchestrateView: show }),

  getActiveOrchestration: () => {
    const { orchestrations, activeOrchestrationId } = get();
    return orchestrations.find((o) => o.id === activeOrchestrationId);
  },

  getNextPendingTask: (orchestrationId) => {
    const orchestration = get().orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return undefined;
    return orchestration.tasks.find((t) => t.status === "pending");
  },

  getOrchestrationProgress: (orchestrationId) => {
    const orchestration = get().orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration || orchestration.tasks.length === 0)
      return { completed: 0, total: 0, percent: 0 };
    const completed = orchestration.tasks.filter(
      (t) => t.status === "completed" || t.status === "skipped"
    ).length;
    return {
      completed,
      total: orchestration.tasks.length,
      percent: Math.round((completed / orchestration.tasks.length) * 100),
    };
  },
}));
