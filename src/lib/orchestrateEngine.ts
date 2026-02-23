import type { OrchestrateTask, DeveloperSlot, PendingPrompt, Orchestration, DevTaskSummary } from "../types/orchestrate";
import { useOrchestrateStore } from "../stores/useOrchestrateStore";
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

/** Get or create a hidden container for orchestrate terminal sessions */
function getOrchestrateContainer(): HTMLDivElement {
  let el = document.getElementById(
    "orchestrate-terminal-container"
  ) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "orchestrate-terminal-container";
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
 * Build the CLI command string for an agent in orchestrate auto mode.
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
// Token Budget
// ---------------------------------------------------------------------------

const PROMPT_BUDGETS = { plan: 30_000, dev: 20_000, review: 30_000 };

interface PromptSection {
  label: string;
  content: string;
  priority: number;  // higher = more important
}

/**
 * Assemble prompt sections within a character budget.
 * Includes sections by priority (highest first), truncating the lowest-priority
 * section that doesn't fully fit. Reassembles in original insertion order.
 */
function buildPromptWithBudget(
  sections: PromptSection[],
  maxChars: number
): string {
  // Sort by priority descending to decide inclusion order
  const byPriority = [...sections]
    .map((s, idx) => ({ ...s, idx }))
    .sort((a, b) => b.priority - a.priority);

  let remaining = maxChars;
  const included = new Set<number>();

  for (const section of byPriority) {
    if (!section.content) continue;
    if (section.content.length <= remaining) {
      included.add(section.idx);
      remaining -= section.content.length;
    } else if (remaining > 100) {
      // Truncate lowest-priority section that doesn't fully fit
      section.content = section.content.slice(0, remaining - 20) + "\n[...truncated]";
      included.add(section.idx);
      remaining = 0;
    }
  }

  // Reassemble in original insertion order
  return sections
    .filter((_, i) => included.has(i))
    .map((s) => s.content)
    .join("\n\n");
}

/** Extract TASK_JOURNAL from terminal output */
function extractJournal(output: string): string | undefined {
  const match = output.match(/TASK_JOURNAL_START\s*\n([\s\S]*?)TASK_JOURNAL_END/);
  if (match) {
    return match[1].trim().slice(0, 1000);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

class OrchestrateEngine {
  private static instance: OrchestrateEngine;
  private cleanupFns = new Map<string, Array<() => void>>();

  static getInstance(): OrchestrateEngine {
    if (!OrchestrateEngine.instance) {
      OrchestrateEngine.instance = new OrchestrateEngine();
    }
    return OrchestrateEngine.instance;
  }

  // ---------------------------------------------------------------------------
  // Planning Phase
  // ---------------------------------------------------------------------------

  async startPlanning(orchestrationId: string): Promise<void> {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    store.setPhase(orchestrationId, "planning");
    store.clearPlanOutput();

    // Worktree is created at orchestration creation time (OrchestrateCreator).
    // Use planWorktreePath, falling back to repo path.
    const worktreePath = orchestration.planWorktreePath ?? orchestration.repoPath;

    store.updateOrchestration(orchestrationId, {
      startedAt: new Date().toISOString(),
    });

    // Create a terminal session for the plan agent
    const tabId = `orch-plan-${orchestrationId}`;
    const container = getOrchestrateContainer();
    const session = createSession(tabId, worktreePath, container);

    store.updateOrchestration(orchestrationId, { planTabId: tabId });

    // Accumulate output
    let outputBuffer = "";
    const cleanupOutput = registerOutputListener(tabId, (data) => {
      const text = stripAnsi(data);
      outputBuffer += text;
      store.appendPlanOutput(text);
    });

    // When process exits, parse the plan
    const cleanupExit = registerExitListener(tabId, (exitCode) => {
      // Store the raw planning output for shared context
      store.updateOrchestration(orchestrationId, {
        planOutput: outputBuffer.slice(-5000),
      });

      if (exitCode === 0) {
        this.parsePlanOutput(orchestrationId, outputBuffer);
      } else {
        store.updateOrchestration(orchestrationId, {
          error: `Plan agent exited with code ${exitCode}`,
        });
        // Still try to parse — agent might have produced output before failing
        this.parsePlanOutput(orchestrationId, outputBuffer);
      }
    });

    this.trackCleanup(orchestrationId, [cleanupOutput, cleanupExit]);

    // Build the planning prompt
    const prompt = this.buildPlanPrompt(orchestration);
    const shell = getShell();
    const escapedPrompt = escapeShellArg(prompt);
    const agentCmd = orchestration.planAgentId === "claude"
      ? "claude --dangerously-skip-permissions --print"
      : orchestration.planAgentId;
    const args = agentShellArgs(
      shell,
      `${agentCmd} -p '${escapedPrompt}'`
    );

    spawnInSession(session, shell.command, args, orchestration.planAgentId, orchestration.envSnapshot);
  }

  private parsePlanOutput(orchestrationId: string, output: string): void {
    const store = useOrchestrateStore.getState();
    const parsed = parseJsonFromOutput(output);

    const mapTaskItem = (item: unknown, i: number): OrchestrateTask => {
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
      store.setTasks(orchestrationId, parsed.map(mapTaskItem));
    } else if (parsed && typeof parsed === "object" && "tasks" in (parsed as Record<string, unknown>)) {
      const tasksArray = (parsed as { tasks: unknown[] }).tasks;
      if (Array.isArray(tasksArray)) {
        store.setTasks(orchestrationId, tasksArray.map(mapTaskItem));
      }
    } else {
      // Could not parse — leave tasks empty, user can see raw output
      store.updateOrchestration(orchestrationId, {
        error: "Could not parse plan output. You can add tasks manually.",
      });
    }
  }

  private buildPlanPrompt(orchestration: Orchestration): string {
    const { featureDescription, maxParallel, contextImages } = orchestration;

    const parallelNote =
      maxParallel > 1
        ? `You have ${maxParallel} developers available to work in parallel on the same codebase. Design the tasks so that ${maxParallel} developers can work simultaneously without conflicts — assign tasks that touch different files or modules. Group related file changes into the same task to avoid merge conflicts.`
        : "The tasks will be executed sequentially by a single developer.";

    let imageNote = "";
    if (contextImages && contextImages.length > 0) {
      imageNote = `Reference images have been provided in the working directory. Review these files for visual context before planning:\n${contextImages.map((p) => `- ${p}`).join("\n")}`;
    }

    const sections: PromptSection[] = [
      {
        label: "instructions",
        priority: 10,
        content: `You are a Dev Lead. Given the following feature request, create a structured implementation plan as a JSON array of tasks. Each task should have: "title" (short imperative title), "description" (detailed implementation instructions), and "complexity" ("small", "medium", or "large").

Break the feature into logical, independently implementable tasks.`,
      },
      {
        label: "feature",
        priority: 9,
        content: `Feature request:\n${featureDescription}`,
      },
      {
        label: "parallel",
        priority: 7,
        content: parallelNote,
      },
      {
        label: "images",
        priority: 3,
        content: imageNote,
      },
      {
        label: "output",
        priority: 10,
        content: "Output ONLY a JSON array wrapped in ```json ... ``` fences. No other text.",
      },
    ];

    return buildPromptWithBudget(sections, PROMPT_BUDGETS.plan);
  }

  // ---------------------------------------------------------------------------
  // Development Phase
  // ---------------------------------------------------------------------------

  async startDevelopment(orchestrationId: string): Promise<void> {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    store.setPhase(orchestrationId, "developing");

    // Create developer slots based on maxParallel — all share the orchestration worktree
    const pendingCount = orchestration.tasks.filter((t) => t.status === "pending").length;
    const slotCount = Math.min(orchestration.maxParallel, pendingCount);
    const developers: DeveloperSlot[] = [];
    for (let i = 0; i < slotCount; i++) {
      developers.push({
        id: crypto.randomUUID(),
        agentId: orchestration.devAgentId,
        worktreePath: orchestration.planWorktreePath,
        status: "idle",
      });
    }
    store.setDevelopers(orchestrationId, developers);

    // Assign initial tasks to each developer slot
    for (const dev of developers) {
      this.assignNextTask(orchestrationId, dev.id);
    }
  }

  private assignNextTask(
    orchestrationId: string,
    developerId: string
  ): void {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return;

    const nextTask = orchestration.tasks.find((t) => t.status === "pending");
    if (!nextTask) {
      // No more tasks — mark developer idle and check completion
      store.updateDeveloper(orchestrationId, developerId, { status: "idle", taskId: undefined });
      this.checkDevelopmentComplete(orchestrationId);
      return;
    }

    // The shared orchestration worktree (created during planning)
    const worktreePath = orchestration.planWorktreePath ?? orchestration.repoPath;

    // Mark task as in_progress
    store.updateTask(orchestrationId, nextTask.id, {
      status: "in_progress",
      developerId,
      worktreePath,
      startedAt: new Date().toISOString(),
    });
    store.updateDeveloper(orchestrationId, developerId, {
      taskId: nextTask.id,
      status: "working",
    });

    // Create terminal session for this task
    const tabId = `orch-dev-${developerId}-${nextTask.id.slice(0, 8)}`;
    const container = getOrchestrateContainer();

    // Destroy existing session if any (from a previous task)
    if (sessions.has(tabId)) {
      destroySession(tabId);
    }

    const session = createSession(tabId, worktreePath, container);
    store.updateTask(orchestrationId, nextTask.id, { tabId });
    store.updateDeveloper(orchestrationId, developerId, { tabId });

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
        store.updateTask(orchestrationId, nextTask.id, { pendingPrompt });
        recentChunk = ""; // Reset after detection to avoid repeat triggers
      }

      // Update output log
      store.updateTask(orchestrationId, nextTask.id, {
        outputLog: taskOutput.slice(-10000), // Keep last 10k chars
      });
    });

    const cleanupExit = registerExitListener(tabId, (exitCode) => {
      const status = exitCode === 0 ? "completed" : "failed";

      // Extract journal from terminal output
      const journal = extractJournal(taskOutput);
      store.updateTask(orchestrationId, nextTask.id, {
        status,
        completedAt: new Date().toISOString(),
        journal,
        ...(status === "failed" ? { error: `Agent exited with code ${exitCode}` } : {}),
      });
      store.updateDeveloper(orchestrationId, developerId, {
        status: status === "completed" ? "completed" : "failed",
      });

      // Capture dev task summary for shared context
      const currentOrch = store.orchestrations.find((o) => o.id === orchestrationId);
      if (currentOrch) {
        const summary: DevTaskSummary = {
          taskId: nextTask.id,
          taskTitle: nextTask.title,
          outputSnippet: taskOutput.slice(-2000),
          status,
          journal,
        };
        store.updateOrchestration(orchestrationId, {
          devSummaries: [...(currentOrch.devSummaries ?? []), summary],
        });
      }

      // Clean up listeners for this tab
      cleanupOutput();
      cleanupExit();

      // Assign the next task (sequential in shared worktree)
      this.assignNextTask(orchestrationId, developerId);
    });

    this.trackCleanup(orchestrationId, [cleanupOutput, cleanupExit]);

    // Spawn the agent with the task prompt
    const shell = getShell();
    const agentCommand = orchestration.devAgentId === "shell" ? "" : getAutoModeCommand(orchestration.devAgentId);
    if (!agentCommand) {
      spawnInSession(session, shell.command, [...shell.args], "shell", orchestration.envSnapshot);
    } else {
      const prompt = this.buildDevPrompt(nextTask, orchestration);
      const escapedPrompt = escapeShellArg(prompt);
      const args = agentShellArgs(shell, `${agentCommand} -p '${escapedPrompt}'`);
      spawnInSession(session, shell.command, args, orchestration.devAgentId, orchestration.envSnapshot);
    }
  }

  private checkDevelopmentComplete(orchestrationId: string): void {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return;

    const allTasksDone = orchestration.tasks.every(
      (t) => t.status === "completed" || t.status === "failed" || t.status === "skipped"
    );
    const allDevsIdle = orchestration.developers.every(
      (d) => d.status !== "working"
    );

    if (allTasksDone && allDevsIdle) {
      const hasCompletedTasks = orchestration.tasks.some((t) => t.status === "completed");
      if (hasCompletedTasks) {
        // Auto-transition to review is NOT done — user triggers it
        // Just update phase to show development is complete
        store.updateOrchestration(orchestrationId, {
          phase: "developing", // stay in developing, UI will show "Ready for Review" state
        });
      } else {
        store.setPhase(orchestrationId, "failed");
        store.updateOrchestration(orchestrationId, {
          error: "All tasks failed during development",
        });
      }
    }
  }

  private buildDevPrompt(task: OrchestrateTask, orchestration: Orchestration): string {
    // Build task list overview for context
    const taskListOverview = orchestration.tasks
      .map((t, i) => `${i + 1}. [${t.status}] ${t.title}`)
      .join("\n");

    // Plan context from planning phase (cap at 2000 chars for dev prompt)
    let planContext = "";
    if (orchestration.planOutput) {
      const capped = orchestration.planOutput.slice(0, 2000);
      planContext = `Architectural plan from the lead developer:\n${capped}`;
    }

    // Peer journals from completed tasks
    let peerJournals = "";
    const completedWithJournals = orchestration.tasks.filter(
      (t) => t.id !== task.id && t.journal && (t.status === "completed" || t.status === "failed")
    );
    if (completedWithJournals.length > 0) {
      const journalLines = completedWithJournals
        .map((t) => `### ${t.title}\n${t.journal}`)
        .join("\n\n");
      peerJournals = `What other developers have already done:\n${journalLines}`;
    }

    let imageNote = "";
    if (orchestration.contextImages && orchestration.contextImages.length > 0) {
      imageNote = `Reference images are available in the working directory. Review these files if they are relevant to your task:\n${orchestration.contextImages.map((p) => `- ${p}`).join("\n")}`;
    }

    const sections: PromptSection[] = [
      {
        label: "task",
        priority: 10,
        content: `You are implementing a task as part of a larger feature.\n\nYour assigned task:\nTitle: ${task.title}\nDescription: ${task.description}`,
      },
      {
        label: "feature",
        priority: 9,
        content: `Feature: ${orchestration.featureDescription}`,
      },
      {
        label: "requirements",
        priority: 8,
        content: `Requirements:
- Work in the current directory
- Make all necessary code changes
- Run any relevant tests if applicable
- Stage your changes with git add but DO NOT commit. Leave the changes staged.
- Before you finish, output a brief summary of what you changed:
  TASK_JOURNAL_START
  - Changed file X to do Y
  - Added function Z in module W
  TASK_JOURNAL_END
- When you are done, type /exit to finish`,
      },
      {
        label: "taskList",
        priority: 6,
        content: `All tasks in this feature:\n${taskListOverview}`,
      },
      {
        label: "planContext",
        priority: 5,
        content: planContext,
      },
      {
        label: "peerJournals",
        priority: 4,
        content: peerJournals,
      },
      {
        label: "images",
        priority: 3,
        content: imageNote,
      },
    ];

    return buildPromptWithBudget(sections, PROMPT_BUDGETS.dev);
  }

  // ---------------------------------------------------------------------------
  // Review Phase
  // ---------------------------------------------------------------------------

  async startReview(orchestrationId: string): Promise<void> {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    store.setPhase(orchestrationId, "reviewing");

    // Run a single review of the entire branch diff against the base branch
    await this.reviewBranch(orchestrationId);
  }

  private async reviewBranch(orchestrationId: string): Promise<void> {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return;

    store.updateOrchestration(orchestrationId, {
      branchReview: {
        reviewerId: orchestration.reviewAgentId,
        status: "in_progress",
        comments: [],
      },
    });

    const tabId = `orch-review-${orchestrationId.slice(0, 8)}`;
    const container = getOrchestrateContainer();

    if (sessions.has(tabId)) {
      destroySession(tabId);
    }

    // Review in the orchestration worktree where all changes live
    const reviewPath = orchestration.planWorktreePath ?? orchestration.repoPath;
    const session = createSession(tabId, reviewPath, container);

    store.updateOrchestration(orchestrationId, {
      branchReview: {
        reviewerId: orchestration.reviewAgentId,
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
      this.parseReviewOutput(orchestrationId, outputBuffer);
      cleanupOutput();
      cleanupExit();
    });

    this.trackCleanup(orchestrationId, [cleanupOutput, cleanupExit]);

    // Use interactive mode so the review agent can run git diff itself
    const prompt = this.buildReviewPrompt(orchestration);
    const shell = getShell();
    const escapedPrompt = escapeShellArg(prompt);
    const reviewCmd = getAutoModeCommand(orchestration.reviewAgentId);
    const args = agentShellArgs(
      shell,
      `${reviewCmd} -p '${escapedPrompt}'`
    );

    spawnInSession(session, shell.command, args, orchestration.reviewAgentId, orchestration.envSnapshot);
  }

  private parseReviewOutput(
    orchestrationId: string,
    output: string
  ): void {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
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
      store.updateOrchestration(orchestrationId, {
        branchReview: {
          reviewerId: orchestration?.reviewAgentId ?? "claude",
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
      store.updateOrchestration(orchestrationId, {
        branchReview: {
          reviewerId: orchestration?.reviewAgentId ?? "claude",
          status: "approved",
          summary: "Could not parse review output. Raw output available in logs.",
          comments: [],
          completedAt: new Date().toISOString(),
        },
      });
    }

    // Mark orchestration as completed after review
    store.setPhase(orchestrationId, "completed");
  }

  private buildReviewPrompt(orchestration: Orchestration): string {
    const { baseBranch, featureDescription, devSummaries, contextImages } = orchestration;

    // Prefer journal over raw output for summaries
    let summariesNote = "";
    if (devSummaries && devSummaries.length > 0) {
      const summaryLines = devSummaries.map((s) => {
        const detail = s.journal ? s.journal : s.outputSnippet.slice(-500);
        return `- [${s.status}] ${s.taskTitle}: ${detail}`;
      }).join("\n");
      summariesNote = `Development task summaries:\n${summaryLines}`;
    }

    let imageNote = "";
    if (contextImages && contextImages.length > 0) {
      imageNote = `Reference images are available in the working directory:\n${contextImages.map((p) => `- ${p}`).join("\n")}`;
    }

    const sections: PromptSection[] = [
      {
        label: "instructions",
        priority: 10,
        content: `You are a senior code reviewer. Review all the changes on this branch compared to the base branch '${baseBranch}'.`,
      },
      {
        label: "feature",
        priority: 9,
        content: `Feature being implemented: ${featureDescription}`,
      },
      {
        label: "commands",
        priority: 8,
        content: `First, run this command to see all the changes:
  git diff ${baseBranch}

You can also run \`git diff ${baseBranch} --stat\` for an overview, and read specific files if you need more context.

Review the implementation for:
- Code quality and correctness
- Potential bugs or edge cases
- Architecture and design concerns
- Missing error handling
- Security issues`,
      },
      {
        label: "summaries",
        priority: 5,
        content: summariesNote,
      },
      {
        label: "images",
        priority: 3,
        content: imageNote,
      },
      {
        label: "output",
        priority: 10,
        content: `After your review, output your findings as JSON with this structure:
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

Output ONLY the JSON wrapped in \`\`\`json ... \`\`\` fences at the end. No other text after the JSON.`,
      },
    ];

    return buildPromptWithBudget(sections, PROMPT_BUDGETS.review);
  }

  // ---------------------------------------------------------------------------
  // Cancel / Cleanup
  // ---------------------------------------------------------------------------

  async cancelOrchestration(orchestrationId: string): Promise<void> {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return;

    // Kill all active terminal sessions
    for (const dev of orchestration.developers) {
      if (dev.tabId && sessions.has(dev.tabId)) {
        destroySession(dev.tabId);
      }
    }
    if (orchestration.planTabId && sessions.has(orchestration.planTabId)) {
      destroySession(orchestration.planTabId);
    }
    // Kill review session
    if (orchestration.branchReview?.tabId && sessions.has(orchestration.branchReview.tabId)) {
      destroySession(orchestration.branchReview.tabId);
    }

    // Run tracked cleanup functions
    const fns = this.cleanupFns.get(orchestrationId) ?? [];
    for (const fn of fns) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    this.cleanupFns.delete(orchestrationId);

    store.setPhase(orchestrationId, "cancelled");
  }

  async cleanupWorktrees(orchestrationId: string): Promise<void> {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return;

    // Remove the single orchestration worktree
    if (orchestration.planWorkspaceId) {
      try {
        await deleteWorkspaceWithWorktree(orchestration.planWorkspaceId);
      } catch {
        /* ignore */
      }
    } else if (orchestration.planWorktreePath && orchestration.planWorktreePath !== orchestration.repoPath) {
      try {
        await removeWorktree(orchestration.repoPath, orchestration.planWorktreePath);
      } catch {
        /* ignore */
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Utility: track cleanup functions for an orchestration
  // ---------------------------------------------------------------------------

  private trackCleanup(orchestrationId: string, fns: Array<() => void>): void {
    const existing = this.cleanupFns.get(orchestrationId) ?? [];
    this.cleanupFns.set(orchestrationId, [...existing, ...fns]);
  }

  // ---------------------------------------------------------------------------
  // Prompt Response — send user input to a blocked agent
  // ---------------------------------------------------------------------------

  sendPromptResponse(
    orchestrationId: string,
    taskId: string,
    response: string
  ): void {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return;

    const task = orchestration.tasks.find((t) => t.id === taskId);
    if (!task?.tabId) return;

    const session = sessions.get(task.tabId);
    if (!session?.pty) return;

    // Write the response to the PTY
    const text = response === "enter" ? "\n" : response + "\n";
    session.pty.write(text);

    // Clear the pending prompt
    store.updateTask(orchestrationId, taskId, { pendingPrompt: undefined });
  }

  // ---------------------------------------------------------------------------
  // Retry — revert a cancelled/failed step to the previous step's state
  // ---------------------------------------------------------------------------

  async retryPhase(orchestrationId: string): Promise<void> {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return;
    if (orchestration.phase !== "cancelled" && orchestration.phase !== "failed") return;

    // Infer which phase was active when the orchestration stopped:
    //  - Has reviews on any task -> was in review phase
    //  - Has developer slots -> was in development phase
    //  - Otherwise -> was in planning
    const hasReviews = !!orchestration.branchReview;
    const hasDevSlots = orchestration.developers.length > 0;

    if (hasReviews) {
      // Was in review -> revert to development-complete state
      // Clear branch review data, keep task completion status
      store.updateOrchestration(orchestrationId, { branchReview: undefined, error: undefined });
      store.setPhase(orchestrationId, "developing");
    } else if (hasDevSlots) {
      // Was in development -> revert to planning-complete state (tasks visible)
      // Worktree is shared, so no per-developer cleanup needed

      // Reset in-progress/failed tasks back to pending, keep task list
      for (const task of orchestration.tasks) {
        if (task.status === "in_progress" || task.status === "failed") {
          store.updateTask(orchestrationId, task.id, {
            status: "pending",
            developerId: undefined,
            worktreePath: undefined,
            branch: undefined,
            tabId: undefined,
            outputLog: "",
            pendingPrompt: undefined,
            journal: undefined,
            error: undefined,
            startedAt: undefined,
            completedAt: undefined,
          });
        }
      }

      // Clear developer slots
      store.setDevelopers(orchestrationId, []);
      store.updateOrchestration(orchestrationId, { error: undefined });
      store.setPhase(orchestrationId, "planning");
    } else {
      // Was in planning -> just reset and allow re-run
      store.updateOrchestration(orchestrationId, {
        error: undefined,
        startedAt: undefined,
      });
      store.setPhase(orchestrationId, "planning");
    }
  }

  /** Check if all developer tasks are done (for UI to show "Ready for Review") */
  isDevelopmentComplete(orchestrationId: string): boolean {
    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return false;
    return (
      orchestration.tasks.length > 0 &&
      orchestration.tasks.every(
        (t) =>
          t.status === "completed" ||
          t.status === "failed" ||
          t.status === "skipped"
      )
    );
  }
}

export const engine = OrchestrateEngine.getInstance();
