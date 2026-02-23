import type { WorkflowTask, DeveloperSlot, PendingPrompt } from "../types/workflow";
import { useWorkflowStore } from "../stores/useWorkflowStore";
import { useAppStore } from "../stores/useAppStore";
import { resolveShell, agentShellArgs } from "./agents";
import {
  createSession,
  spawnInSession,
  destroySession,
  sessions,
} from "../components/terminal/XtermTerminal";
import {
  registerOutputListener,
  registerExitListener,
} from "./terminalMonitor";
import {
  deleteWorkspaceWithWorktree,
  removeWorktree,
} from "./tauri";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getShell() {
  const settings = useAppStore.getState().settings;
  return resolveShell(settings.defaultShell);
}

/** Get or create a hidden container for workflow terminal sessions */
function getWorkflowContainer(): HTMLDivElement {
  let el = document.getElementById(
    "workflow-terminal-container"
  ) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "workflow-terminal-container";
    el.style.position = "fixed";
    el.style.width = "1px";
    el.style.height = "1px";
    el.style.overflow = "hidden";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
  }
  return el;
}

function escapeShellArg(s: string): string {
  return s.replace(/'/g, "'\\''");
}

/** Extract JSON from markdown code fences or raw JSON */
function parseJsonFromOutput(output: string): unknown | null {
  // Try to find JSON in ```json ... ``` fences
  const fenceMatch = output.match(/```json\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // Try to find a JSON array directly
  const arrayMatch = output.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // fall through
    }
  }

  // Try to find a JSON object
  const objMatch = output.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // fall through
    }
  }

  return null;
}

/** Strip ANSI escape codes and terminal control sequences from output */
function stripAnsi(s: string): string {
  return (
    s
      // CSI sequences including private mode (e.g. \x1b[?2026h, \x1b[0m, \x1b[1;32m)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[\x20-\x3f]*[0-9;]*[\x20-\x7e]/g, "")
      // OSC sequences (e.g. \x1b]0;title\x07 or \x1b]0;title\x1b\\)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
      // Other 2-char escape sequences (charset, keypad modes, etc.)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b[^[\]]/g, "")
      // Carriage returns
      .replace(/\r/g, "")
  );
}

/**
 * Build the CLI command string for an agent in workflow auto mode.
 * Adds --dangerously-skip-permissions for claude, --full-auto for codex, etc.
 */
function getAutoModeCommand(agentId: string): string {
  switch (agentId) {
    case "claude":
      return "claude --dangerously-skip-permissions";
    case "codex":
      return "codex --full-auto";
    default:
      return agentId;
  }
}

/** Known prompt patterns that indicate the agent is waiting for user input */
const PROMPT_PATTERNS: Array<{
  regex: RegExp;
  message: string;
  options: string[];
}> = [
  {
    regex: /(?:Yes,\s*I\s*trust|trust\s*this\s*folder)/i,
    message: "Claude Code is asking to trust this folder",
    options: ["1"],  // send "1" for "Yes, I trust this folder"
  },
  {
    regex: /Do you want to proceed\?/i,
    message: "Agent is asking to proceed",
    options: ["y"],
  },
  {
    regex: /\(y\/n\)\s*$/i,
    message: "Agent is asking for confirmation",
    options: ["y", "n"],
  },
  {
    regex: /Enter to confirm/i,
    message: "Agent is waiting for confirmation",
    options: ["enter"],
  },
  {
    regex: /Press Enter to continue/i,
    message: "Agent is waiting to continue",
    options: ["enter"],
  },
];

/**
 * Check terminal output for known prompt patterns.
 * Returns a PendingPrompt if a prompt is detected in recent output, or null.
 */
function detectPrompt(recentOutput: string): PendingPrompt | null {
  for (const pattern of PROMPT_PATTERNS) {
    if (pattern.regex.test(recentOutput)) {
      return {
        message: pattern.message,
        options: pattern.options,
        context: recentOutput.slice(-300),
        detectedAt: new Date().toISOString(),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

class WorkflowOrchestrator {
  private static instance: WorkflowOrchestrator;
  private cleanupFns = new Map<string, Array<() => void>>();

  static getInstance(): WorkflowOrchestrator {
    if (!WorkflowOrchestrator.instance) {
      WorkflowOrchestrator.instance = new WorkflowOrchestrator();
    }
    return WorkflowOrchestrator.instance;
  }

  // ---------------------------------------------------------------------------
  // Planning Phase
  // ---------------------------------------------------------------------------

  async startPlanning(workflowId: string): Promise<void> {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error("Workflow not found");

    store.setPhase(workflowId, "planning");
    store.clearPlanOutput();

    // Worktree is created at workflow creation time (WorkflowCreator).
    // Use planWorktreePath, falling back to repo path.
    const worktreePath = workflow.planWorktreePath ?? workflow.repoPath;

    store.updateWorkflow(workflowId, {
      startedAt: new Date().toISOString(),
    });

    // Create a terminal session for the plan agent
    const tabId = `wf-plan-${workflowId}`;
    const container = getWorkflowContainer();
    const session = createSession(tabId, worktreePath, container);

    store.updateWorkflow(workflowId, { planTabId: tabId });

    // Accumulate output
    let outputBuffer = "";
    const cleanupOutput = registerOutputListener(tabId, (data) => {
      const text = stripAnsi(data);
      outputBuffer += text;
      store.appendPlanOutput(text);
    });

    // When process exits, parse the plan
    const cleanupExit = registerExitListener(tabId, (exitCode) => {
      if (exitCode === 0) {
        this.parsePlanOutput(workflowId, outputBuffer);
      } else {
        store.updateWorkflow(workflowId, {
          error: `Plan agent exited with code ${exitCode}`,
        });
        // Still try to parse — agent might have produced output before failing
        this.parsePlanOutput(workflowId, outputBuffer);
      }
    });

    this.trackCleanup(workflowId, [cleanupOutput, cleanupExit]);

    // Build the planning prompt — include developer count
    const prompt = this.buildPlanPrompt(
      workflow.featureDescription,
      workflow.maxParallel
    );
    const shell = getShell();
    const escapedPrompt = escapeShellArg(prompt);
    const agentCmd = workflow.planAgentId === "claude"
      ? "claude --dangerously-skip-permissions --print"
      : workflow.planAgentId;
    const args = agentShellArgs(
      shell,
      `${agentCmd} -p '${escapedPrompt}'`
    );

    spawnInSession(session, shell.command, args, workflow.planAgentId);
  }

  private parsePlanOutput(workflowId: string, output: string): void {
    const store = useWorkflowStore.getState();
    const parsed = parseJsonFromOutput(output);

    const mapTaskItem = (item: unknown, i: number): WorkflowTask => {
      const obj = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const complexity = typeof obj.complexity === "string" && ["small", "medium", "large"].includes(obj.complexity)
        ? (obj.complexity as "small" | "medium" | "large")
        : "medium";
      return {
        id: crypto.randomUUID(),
        title: typeof obj.title === "string" ? obj.title : `Task ${i + 1}`,
        description: typeof obj.description === "string" ? obj.description : "",
        complexity,
        status: "pending",
        outputLog: "",
      };
    };

    if (Array.isArray(parsed)) {
      store.setTasks(workflowId, parsed.map(mapTaskItem));
    } else if (parsed && typeof parsed === "object" && "tasks" in (parsed as Record<string, unknown>)) {
      const tasksArray = (parsed as { tasks: unknown[] }).tasks;
      if (Array.isArray(tasksArray)) {
        store.setTasks(workflowId, tasksArray.map(mapTaskItem));
      }
    } else {
      // Could not parse — leave tasks empty, user can see raw output
      store.updateWorkflow(workflowId, {
        error: "Could not parse plan output. You can add tasks manually.",
      });
    }
  }

  private buildPlanPrompt(
    featureDescription: string,
    maxParallel: number
  ): string {
    const parallelNote =
      maxParallel > 1
        ? `\n\nYou have ${maxParallel} developers available to work in parallel on the same codebase. Design the tasks so that ${maxParallel} developers can work simultaneously without conflicts — assign tasks that touch different files or modules. Group related file changes into the same task to avoid merge conflicts.`
        : "\n\nThe tasks will be executed sequentially by a single developer.";

    return `You are a Dev Lead. Given the following feature request, create a structured implementation plan as a JSON array of tasks. Each task should have: "title" (short imperative title), "description" (detailed implementation instructions), and "complexity" ("small", "medium", or "large").

Break the feature into logical, independently implementable tasks.${parallelNote}

Feature request:
${featureDescription}

Output ONLY a JSON array wrapped in \`\`\`json ... \`\`\` fences. No other text.`;
  }

  // ---------------------------------------------------------------------------
  // Development Phase
  // ---------------------------------------------------------------------------

  async startDevelopment(workflowId: string): Promise<void> {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error("Workflow not found");

    store.setPhase(workflowId, "developing");

    // Create developer slots based on maxParallel — all share the workflow worktree
    const pendingCount = workflow.tasks.filter((t) => t.status === "pending").length;
    const slotCount = Math.min(workflow.maxParallel, pendingCount);
    const developers: DeveloperSlot[] = [];
    for (let i = 0; i < slotCount; i++) {
      developers.push({
        id: crypto.randomUUID(),
        agentId: workflow.devAgentId,
        worktreePath: workflow.planWorktreePath,
        status: "idle",
      });
    }
    store.setDevelopers(workflowId, developers);

    // Assign initial tasks to each developer slot
    for (const dev of developers) {
      this.assignNextTask(workflowId, dev.id);
    }
  }

  private assignNextTask(
    workflowId: string,
    developerId: string
  ): void {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    const nextTask = workflow.tasks.find((t) => t.status === "pending");
    if (!nextTask) {
      // No more tasks — mark developer idle and check completion
      store.updateDeveloper(workflowId, developerId, { status: "idle", taskId: undefined });
      this.checkDevelopmentComplete(workflowId);
      return;
    }

    // The shared workflow worktree (created during planning)
    const worktreePath = workflow.planWorktreePath ?? workflow.repoPath;

    // Mark task as in_progress
    store.updateTask(workflowId, nextTask.id, {
      status: "in_progress",
      developerId,
      worktreePath,
      startedAt: new Date().toISOString(),
    });
    store.updateDeveloper(workflowId, developerId, {
      taskId: nextTask.id,
      status: "working",
    });

    // Create terminal session for this task
    const tabId = `wf-dev-${developerId}-${nextTask.id.slice(0, 8)}`;
    const container = getWorkflowContainer();

    // Destroy existing session if any (from a previous task)
    if (sessions.has(tabId)) {
      destroySession(tabId);
    }

    const session = createSession(tabId, worktreePath, container);
    store.updateTask(workflowId, nextTask.id, { tabId });
    store.updateDeveloper(workflowId, developerId, { tabId });

    // Monitor output
    let taskOutput = "";
    let recentChunk = "";
    const cleanupOutput = registerOutputListener(tabId, (data) => {
      const text = stripAnsi(data);
      taskOutput += text;
      recentChunk += text;

      // Keep a sliding window of recent output for prompt detection
      if (recentChunk.length > 2000) {
        recentChunk = recentChunk.slice(-1000);
      }

      // Check for prompt patterns in recent output
      const pendingPrompt = detectPrompt(recentChunk);
      if (pendingPrompt) {
        store.updateTask(workflowId, nextTask.id, { pendingPrompt });
        recentChunk = ""; // Reset after detection to avoid repeat triggers
      }

      // Update output log
      store.updateTask(workflowId, nextTask.id, {
        outputLog: taskOutput.slice(-10000), // Keep last 10k chars
      });
    });

    const cleanupExit = registerExitListener(tabId, (exitCode) => {
      const status = exitCode === 0 ? "completed" : "failed";
      store.updateTask(workflowId, nextTask.id, {
        status,
        completedAt: new Date().toISOString(),
        ...(status === "failed" ? { error: `Agent exited with code ${exitCode}` } : {}),
      });
      store.updateDeveloper(workflowId, developerId, {
        status: status === "completed" ? "completed" : "failed",
      });

      // Clean up listeners for this tab
      cleanupOutput();
      cleanupExit();

      // Assign the next task (sequential in shared worktree)
      this.assignNextTask(workflowId, developerId);
    });

    this.trackCleanup(workflowId, [cleanupOutput, cleanupExit]);

    // Spawn the agent with the task prompt
    const shell = getShell();
    const agentCommand = workflow.devAgentId === "shell" ? "" : getAutoModeCommand(workflow.devAgentId);
    if (!agentCommand) {
      spawnInSession(session, shell.command, [...shell.args], "shell");
    } else {
      const prompt = this.buildDevPrompt(nextTask);
      const escapedPrompt = escapeShellArg(prompt);
      const args = agentShellArgs(shell, `${agentCommand} -p '${escapedPrompt}'`);
      spawnInSession(session, shell.command, args, workflow.devAgentId);
    }
  }

  private checkDevelopmentComplete(workflowId: string): void {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    const allTasksDone = workflow.tasks.every(
      (t) => t.status === "completed" || t.status === "failed" || t.status === "skipped"
    );
    const allDevsIdle = workflow.developers.every(
      (d) => d.status !== "working"
    );

    if (allTasksDone && allDevsIdle) {
      const hasCompletedTasks = workflow.tasks.some((t) => t.status === "completed");
      if (hasCompletedTasks) {
        // Auto-transition to review is NOT done — user triggers it
        // Just update phase to show development is complete
        store.updateWorkflow(workflowId, {
          phase: "developing", // stay in developing, UI will show "Ready for Review" state
        });
      } else {
        store.setPhase(workflowId, "failed");
        store.updateWorkflow(workflowId, {
          error: "All tasks failed during development",
        });
      }
    }
  }

  private buildDevPrompt(task: WorkflowTask): string {
    return `Implement the following task in this repository:

Title: ${task.title}
Description: ${task.description}

Requirements:
- Work in the current directory
- Make all necessary code changes
- Run any relevant tests if applicable
- Stage your changes with git add but DO NOT commit. Leave the changes staged.
- When you are done, type /exit to finish`;
  }

  // ---------------------------------------------------------------------------
  // Review Phase
  // ---------------------------------------------------------------------------

  async startReview(workflowId: string): Promise<void> {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error("Workflow not found");

    store.setPhase(workflowId, "reviewing");

    // Run a single review of the entire branch diff against the base branch
    await this.reviewBranch(workflowId);
  }

  private async reviewBranch(workflowId: string): Promise<void> {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    store.updateWorkflow(workflowId, {
      branchReview: {
        reviewerId: workflow.reviewAgentId,
        status: "in_progress",
        comments: [],
      },
    });

    const tabId = `wf-review-${workflowId.slice(0, 8)}`;
    const container = getWorkflowContainer();

    if (sessions.has(tabId)) {
      destroySession(tabId);
    }

    // Review in the workflow worktree where all changes live
    const reviewPath = workflow.planWorktreePath ?? workflow.repoPath;
    const session = createSession(tabId, reviewPath, container);

    store.updateWorkflow(workflowId, {
      branchReview: {
        reviewerId: workflow.reviewAgentId,
        tabId,
        status: "in_progress",
        comments: [],
      },
    });

    let outputBuffer = "";

    const cleanupOutput = registerOutputListener(tabId, (data) => {
      outputBuffer += stripAnsi(data);
    });

    const cleanupExit = registerExitListener(tabId, (_exitCode) => {
      this.parseReviewOutput(workflowId, outputBuffer);
      cleanupOutput();
      cleanupExit();
    });

    this.trackCleanup(workflowId, [cleanupOutput, cleanupExit]);

    // Use interactive mode so the review agent can run git diff itself
    const prompt = this.buildReviewPrompt(workflow.baseBranch);
    const shell = getShell();
    const escapedPrompt = escapeShellArg(prompt);
    const reviewCmd = getAutoModeCommand(workflow.reviewAgentId);
    const args = agentShellArgs(
      shell,
      `${reviewCmd} -p '${escapedPrompt}'`
    );

    spawnInSession(session, shell.command, args, workflow.reviewAgentId);
  }

  private parseReviewOutput(
    workflowId: string,
    output: string
  ): void {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    const parsed = parseJsonFromOutput(output);

    if (parsed && typeof parsed === "object") {
      const review = parsed as {
        status?: string;
        summary?: string;
        comments?: Array<{
          file?: string;
          line?: number;
          body?: string;
          severity?: string;
        }>;
      };
      store.updateWorkflow(workflowId, {
        branchReview: {
          reviewerId: workflow?.reviewAgentId ?? "claude",
          status:
            review.status === "changes_requested"
              ? "changes_requested"
              : "approved",
          summary: review.summary ?? "",
          comments: (review.comments ?? []).map((c) => ({
            id: crypto.randomUUID(),
            file: c.file ?? "",
            line: c.line,
            body: c.body ?? "",
            severity: (["suggestion", "warning", "blocker"].includes(
              c.severity ?? ""
            )
              ? c.severity
              : "suggestion") as "suggestion" | "warning" | "blocker",
          })),
          completedAt: new Date().toISOString(),
        },
      });
    } else {
      store.updateWorkflow(workflowId, {
        branchReview: {
          reviewerId: workflow?.reviewAgentId ?? "claude",
          status: "approved",
          summary: "Could not parse review output. Raw output available in logs.",
          comments: [],
          completedAt: new Date().toISOString(),
        },
      });
    }

    // Mark workflow as completed after review
    store.setPhase(workflowId, "completed");
  }

  private buildReviewPrompt(baseBranch: string): string {
    return `You are a senior code reviewer. Review all the changes on this branch compared to the base branch '${baseBranch}'.

First, run this command to see all the changes:
  git diff ${baseBranch}

You can also run \`git diff ${baseBranch} --stat\` for an overview, and read specific files if you need more context.

Review the implementation for:
- Code quality and correctness
- Potential bugs or edge cases
- Architecture and design concerns
- Missing error handling
- Security issues

After your review, output your findings as JSON with this structure:
\`\`\`json
{
  "status": "approved" or "changes_requested",
  "summary": "brief overall summary of the review",
  "comments": [
    {
      "file": "path/to/file",
      "line": 42,
      "body": "Your comment explaining the issue or suggestion",
      "severity": "suggestion" or "warning" or "blocker"
    }
  ]
}
\`\`\`

Output ONLY the JSON wrapped in \`\`\`json ... \`\`\` fences at the end. No other text after the JSON.`;
  }

  // ---------------------------------------------------------------------------
  // Cancel / Cleanup
  // ---------------------------------------------------------------------------

  async cancelWorkflow(workflowId: string): Promise<void> {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    // Kill all active terminal sessions
    for (const dev of workflow.developers) {
      if (dev.tabId && sessions.has(dev.tabId)) {
        destroySession(dev.tabId);
      }
    }
    if (workflow.planTabId && sessions.has(workflow.planTabId)) {
      destroySession(workflow.planTabId);
    }
    // Kill review session
    if (workflow.branchReview?.tabId && sessions.has(workflow.branchReview.tabId)) {
      destroySession(workflow.branchReview.tabId);
    }

    // Run tracked cleanup functions
    const fns = this.cleanupFns.get(workflowId) ?? [];
    for (const fn of fns) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    this.cleanupFns.delete(workflowId);

    store.setPhase(workflowId, "cancelled");
  }

  async cleanupWorktrees(workflowId: string): Promise<void> {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    // Remove the single workflow worktree
    if (workflow.planWorkspaceId) {
      try {
        await deleteWorkspaceWithWorktree(workflow.planWorkspaceId);
      } catch {
        /* ignore */
      }
    } else if (workflow.planWorktreePath && workflow.planWorktreePath !== workflow.repoPath) {
      try {
        await removeWorktree(workflow.repoPath, workflow.planWorktreePath);
      } catch {
        /* ignore */
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Utility: track cleanup functions for a workflow
  // ---------------------------------------------------------------------------

  private trackCleanup(workflowId: string, fns: Array<() => void>): void {
    const existing = this.cleanupFns.get(workflowId) ?? [];
    this.cleanupFns.set(workflowId, [...existing, ...fns]);
  }

  // ---------------------------------------------------------------------------
  // Prompt Response — send user input to a blocked agent
  // ---------------------------------------------------------------------------

  sendPromptResponse(
    workflowId: string,
    taskId: string,
    response: string
  ): void {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    const task = workflow.tasks.find((t) => t.id === taskId);
    if (!task?.tabId) return;

    const session = sessions.get(task.tabId);
    if (!session?.pty) return;

    // Write the response to the PTY
    const text = response === "enter" ? "\n" : response + "\n";
    session.pty.write(text);

    // Clear the pending prompt
    store.updateTask(workflowId, taskId, { pendingPrompt: undefined });
  }

  // ---------------------------------------------------------------------------
  // Retry — revert a cancelled/failed step to the previous step's state
  // ---------------------------------------------------------------------------

  async retryPhase(workflowId: string): Promise<void> {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;
    if (workflow.phase !== "cancelled" && workflow.phase !== "failed") return;

    // Infer which phase was active when the workflow stopped:
    //  - Has reviews on any task → was in review phase
    //  - Has developer slots → was in development phase
    //  - Otherwise → was in planning
    const hasReviews = !!workflow.branchReview;
    const hasDevSlots = workflow.developers.length > 0;

    if (hasReviews) {
      // Was in review → revert to development-complete state
      // Clear branch review data, keep task completion status
      store.updateWorkflow(workflowId, { branchReview: undefined, error: undefined });
      store.setPhase(workflowId, "developing");
    } else if (hasDevSlots) {
      // Was in development → revert to planning-complete state (tasks visible)
      // Worktree is shared, so no per-developer cleanup needed

      // Reset in-progress/failed tasks back to pending, keep task list
      for (const task of workflow.tasks) {
        if (task.status === "in_progress" || task.status === "failed") {
          store.updateTask(workflowId, task.id, {
            status: "pending",
            developerId: undefined,
            worktreePath: undefined,
            branch: undefined,
            tabId: undefined,
            outputLog: "",
            pendingPrompt: undefined,
            error: undefined,
            startedAt: undefined,
            completedAt: undefined,
          });
        }
      }

      // Clear developer slots
      store.setDevelopers(workflowId, []);
      store.updateWorkflow(workflowId, { error: undefined });
      store.setPhase(workflowId, "planning");
    } else {
      // Was in planning → just reset and allow re-run
      store.updateWorkflow(workflowId, {
        error: undefined,
        startedAt: undefined,
      });
      store.setPhase(workflowId, "planning");
    }
  }

  /** Check if all developer tasks are done (for UI to show "Ready for Review") */
  isDevelopmentComplete(workflowId: string): boolean {
    const store = useWorkflowStore.getState();
    const workflow = store.workflows.find((w) => w.id === workflowId);
    if (!workflow) return false;
    return (
      workflow.tasks.length > 0 &&
      workflow.tasks.every(
        (t) =>
          t.status === "completed" ||
          t.status === "failed" ||
          t.status === "skipped"
      )
    );
  }
}

export const orchestrator = WorkflowOrchestrator.getInstance();
