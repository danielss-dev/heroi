import { create } from "zustand";
import type {
  Workflow,
  WorkflowTask,
  DeveloperSlot,
  WorkflowPhase,
  TaskReview,
} from "../types/workflow";
import { saveWorkflows, loadWorkflows } from "../lib/tauri";

interface WorkflowState {
  workflows: Workflow[];
  activeWorkflowId: string | null;
  planOutputBuffer: string;
  selectedTaskId: string | null;
  showWorkflowView: boolean;

  // Persistence
  loadFromDisk: () => Promise<void>;

  // CRUD
  createWorkflow: (params: {
    name: string;
    repoPath: string;
    baseBranch: string;
    featureDescription: string;
    maxParallel: number;
    planAgentId: string;
    devAgentId: string;
    reviewAgentId: string;
  }) => Workflow;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  setActiveWorkflow: (id: string | null) => void;

  // Phase transitions
  setPhase: (workflowId: string, phase: WorkflowPhase) => void;

  // Task management
  setTasks: (workflowId: string, tasks: WorkflowTask[]) => void;
  updateTask: (
    workflowId: string,
    taskId: string,
    updates: Partial<WorkflowTask>
  ) => void;
  removeTask: (workflowId: string, taskId: string) => void;
  reorderTasks: (workflowId: string, taskIds: string[]) => void;

  // Developer slot management
  setDevelopers: (workflowId: string, developers: DeveloperSlot[]) => void;
  updateDeveloper: (
    workflowId: string,
    devId: string,
    updates: Partial<DeveloperSlot>
  ) => void;

  // Task review
  setTaskReview: (
    workflowId: string,
    taskId: string,
    review: TaskReview
  ) => void;

  // Planning output
  appendPlanOutput: (text: string) => void;
  clearPlanOutput: () => void;

  // UI
  setSelectedTask: (taskId: string | null) => void;
  setShowWorkflowView: (show: boolean) => void;

  // Derived getters
  getActiveWorkflow: () => Workflow | undefined;
  getNextPendingTask: (workflowId: string) => WorkflowTask | undefined;
  getWorkflowProgress: (workflowId: string) => {
    completed: number;
    total: number;
    percent: number;
  };
}

function updateWorkflowInList(
  workflows: Workflow[],
  id: string,
  updater: (w: Workflow) => Workflow
): Workflow[] {
  return workflows.map((w) => (w.id === id ? updater(w) : w));
}

/** Strip transient/large data before persisting workflows */
function prepareForPersistence(workflows: Workflow[]): unknown[] {
  return workflows.map((w) => ({
    ...w,
    // Strip outputLog and pendingPrompt from tasks (transient terminal data)
    tasks: w.tasks.map((t) => ({
      ...t,
      outputLog: "",
      pendingPrompt: undefined,
    })),
    // Clear developer slots (terminal sessions don't survive restart)
    developers: [],
  }));
}

// Debounced save — avoids hammering the store during rapid output updates
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { workflows, activeWorkflowId } = useWorkflowStore.getState();
    const data = prepareForPersistence(workflows);
    saveWorkflows(data, activeWorkflowId).catch(() => {
      /* ignore save errors */
    });
  }, 1000);
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  activeWorkflowId: null,
  planOutputBuffer: "",
  selectedTaskId: null,
  showWorkflowView: false,

  loadFromDisk: async () => {
    try {
      const data = await loadWorkflows();
      if (data.workflows && Array.isArray(data.workflows) && data.workflows.length > 0) {
        set({
          workflows: data.workflows as Workflow[],
          activeWorkflowId: data.activeWorkflowId,
        });
      }
    } catch {
      // No saved workflows
    }
  },

  createWorkflow: (params) => {
    const workflow: Workflow = {
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
      workflows: [...s.workflows, workflow],
      activeWorkflowId: workflow.id,
      showWorkflowView: true,
    }));
    scheduleSave();
    return workflow;
  },

  updateWorkflow: (id, updates) => {
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, id, (w) => ({
        ...w,
        ...updates,
      })),
    }));
    scheduleSave();
  },

  deleteWorkflow: (id) => {
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      activeWorkflowId:
        s.activeWorkflowId === id ? null : s.activeWorkflowId,
    }));
    scheduleSave();
  },

  setActiveWorkflow: (id) => {
    set({ activeWorkflowId: id });
    scheduleSave();
  },

  setPhase: (workflowId, phase) => {
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, workflowId, (w) => ({
        ...w,
        phase,
        ...(phase === "completed" || phase === "failed" || phase === "cancelled"
          ? { completedAt: new Date().toISOString() }
          : {}),
      })),
    }));
    scheduleSave();
  },

  setTasks: (workflowId, tasks) => {
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, workflowId, (w) => ({
        ...w,
        tasks,
      })),
    }));
    scheduleSave();
  },

  updateTask: (workflowId, taskId, updates) =>
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, workflowId, (w) => ({
        ...w,
        tasks: w.tasks.map((t) =>
          t.id === taskId ? { ...t, ...updates } : t
        ),
      })),
    })),
    // NOTE: updateTask is called very frequently (terminal output), so we
    // do NOT scheduleSave here — save is triggered by phase/task status changes

  removeTask: (workflowId, taskId) => {
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, workflowId, (w) => ({
        ...w,
        tasks: w.tasks.filter((t) => t.id !== taskId),
      })),
    }));
    scheduleSave();
  },

  reorderTasks: (workflowId, taskIds) => {
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, workflowId, (w) => {
        const taskMap = new Map(w.tasks.map((t) => [t.id, t]));
        const reordered = taskIds
          .map((id) => taskMap.get(id))
          .filter((t): t is WorkflowTask => t !== undefined);
        return { ...w, tasks: reordered };
      }),
    }));
    scheduleSave();
  },

  setDevelopers: (workflowId, developers) => {
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, workflowId, (w) => ({
        ...w,
        developers,
      })),
    }));
    scheduleSave();
  },

  updateDeveloper: (workflowId, devId, updates) =>
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, workflowId, (w) => ({
        ...w,
        developers: w.developers.map((d) =>
          d.id === devId ? { ...d, ...updates } : d
        ),
      })),
    })),

  setTaskReview: (workflowId, taskId, review) => {
    set((s) => ({
      workflows: updateWorkflowInList(s.workflows, workflowId, (w) => ({
        ...w,
        tasks: w.tasks.map((t) =>
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
  setShowWorkflowView: (show) => set({ showWorkflowView: show }),

  getActiveWorkflow: () => {
    const { workflows, activeWorkflowId } = get();
    return workflows.find((w) => w.id === activeWorkflowId);
  },

  getNextPendingTask: (workflowId) => {
    const workflow = get().workflows.find((w) => w.id === workflowId);
    if (!workflow) return undefined;
    return workflow.tasks.find((t) => t.status === "pending");
  },

  getWorkflowProgress: (workflowId) => {
    const workflow = get().workflows.find((w) => w.id === workflowId);
    if (!workflow || workflow.tasks.length === 0)
      return { completed: 0, total: 0, percent: 0 };
    const completed = workflow.tasks.filter(
      (t) => t.status === "completed" || t.status === "skipped"
    ).length;
    return {
      completed,
      total: workflow.tasks.length,
      percent: Math.round((completed / workflow.tasks.length) * 100),
    };
  },
}));
