// ---- Workflow Core Types ----

export type WorkflowPhase =
  | "planning"
  | "developing"
  | "reviewing"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

export interface PendingPrompt {
  /** The detected prompt text */
  message: string;
  /** Options extracted from the prompt (e.g. ["Yes", "No"]) */
  options: string[];
  /** Raw terminal text to help the user decide */
  context: string;
  detectedAt: string;
}

export interface WorkflowTask {
  id: string;
  title: string;
  description: string;
  complexity?: "small" | "medium" | "large";
  status: TaskStatus;
  /** Which developer slot is handling this task */
  developerId?: string;
  /** Git worktree path assigned to this task */
  worktreePath?: string;
  /** Branch name for this task's worktree */
  branch?: string;
  /** Terminal tab ID for the developer agent */
  tabId?: string;
  /** Captured terminal output */
  outputLog: string;
  /** Detected prompt waiting for user input */
  pendingPrompt?: PendingPrompt;
  /** Review result, populated during review phase */
  review?: TaskReview;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface TaskReview {
  reviewerId: string;
  tabId?: string;
  status: "pending" | "in_progress" | "approved" | "changes_requested";
  comments: ReviewComment[];
  summary?: string;
  completedAt?: string;
}

export interface ReviewComment {
  id: string;
  file: string;
  line?: number;
  body: string;
  severity: "suggestion" | "warning" | "blocker";
}

export interface DeveloperSlot {
  id: string;
  /** Workspace ID created for this developer */
  workspaceId?: string;
  worktreePath?: string;
  branch?: string;
  agentId: string;
  tabId?: string;
  taskId?: string;
  status: "idle" | "working" | "completed" | "failed";
}

export interface BranchReview {
  reviewerId: string;
  tabId?: string;
  status: "pending" | "in_progress" | "approved" | "changes_requested";
  comments: ReviewComment[];
  summary?: string;
  completedAt?: string;
}

export interface Workflow {
  id: string;
  name: string;
  repoPath: string;
  baseBranch: string;
  featureDescription: string;
  phase: WorkflowPhase;
  tasks: WorkflowTask[];
  developers: DeveloperSlot[];
  maxParallel: number;
  /** Agent IDs for each phase */
  planAgentId: string;
  devAgentId: string;
  reviewAgentId: string;
  /** Planning phase terminal/worktree state */
  planTabId?: string;
  planWorktreePath?: string;
  planWorkspaceId?: string;
  /** Branch-level review (comparing workflow branch vs base branch) */
  branchReview?: BranchReview;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ---- Completion Detection ----

export interface CompletionPattern {
  pattern: string;
  signal: "completed" | "failed" | "needs_input";
}

export const DEFAULT_COMPLETION_PATTERNS: Record<string, CompletionPattern[]> = {
  claude: [
    { pattern: "Process exited with code 0", signal: "completed" },
    { pattern: "Process exited with code (?!0)", signal: "failed" },
  ],
  codex: [
    { pattern: "Process exited with code 0", signal: "completed" },
    { pattern: "Process exited with code (?!0)", signal: "failed" },
  ],
  gemini: [
    { pattern: "Process exited with code 0", signal: "completed" },
    { pattern: "Process exited with code (?!0)", signal: "failed" },
  ],
};
