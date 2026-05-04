import {
  getSchemaVersion,
  migrateToV2,
  listWorkspaceConfigs,
  listRepos,
  getDefaultBranch,
} from "./tauri";
import {
  HEROI_SCHEMA_VERSION,
  type Conversation,
  type MigrationPayloadV2,
  type Project,
  type RepoEntry,
  type Settings,
  type WorkspaceConfig,
} from "../types";

const FALLBACK_BASE_BRANCH = "main";

function basename(p: string): string {
  const norm = p.replace(/[/\\]+$/, "");
  const idx = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return idx === -1 ? norm : norm.slice(idx + 1);
}

// Stable, non-cryptographic hash so projectId is deterministic across reruns.
function deterministicId(prefix: string, input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
    h |= 0;
  }
  return `${prefix}_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

function projectIdFor(repoPath: string): string {
  return deterministicId("proj", repoPath);
}

async function detectDefaultBaseBranch(repoPath: string): Promise<string> {
  try {
    const b = await getDefaultBranch(repoPath);
    return b || FALLBACK_BASE_BRANCH;
  } catch {
    return FALLBACK_BASE_BRANCH;
  }
}

async function buildProjects(repos: RepoEntry[]): Promise<Project[]> {
  const now = new Date().toISOString();
  const projects: Project[] = [];
  for (const repo of repos) {
    const baseBranch = await detectDefaultBaseBranch(repo.path);
    projects.push({
      id: projectIdFor(repo.path),
      name: repo.name || basename(repo.path),
      repoPath: repo.path,
      primaryCheckoutPath: repo.path,
      defaultBaseBranch: baseBranch,
      createdAt: now,
    });
  }
  return projects;
}

function conversationFromWorkspace(
  ws: WorkspaceConfig,
  projects: Project[],
  defaultAgentId: string
): Conversation | null {
  const project = projects.find((p) => p.repoPath === ws.repo_path);
  if (!project) return null;

  const baseBranch = ws.base_branch || project.defaultBaseBranch;

  return {
    id: ws.id,
    projectId: project.id,
    name: ws.name,
    agentId: defaultAgentId,
    mode: "chat",
    workingDir: {
      kind: ws.is_main_worktree ? "primary" : "worktree",
      path: ws.worktree_path,
      branch: ws.branch || null,
      baseBranch,
      worktreeName: ws.is_main_worktree ? undefined : ws.name,
      portBase: ws.port_base,
    },
    envVars: ws.env_vars ?? {},
    status: "exited",
    createdAt: ws.created_at,
    archivedAt: ws.status === "Archived" ? ws.created_at : undefined,
    commandVarCache: {},
  };
}

export interface MigrationReport {
  alreadyMigrated: boolean;
  schemaVersionBefore: number;
  schemaVersionAfter: number;
  projectsWritten: number;
  conversationsWritten: number;
}

/**
 * Migrate the local store from v1 (workspace-centric) to v2 (project +
 * conversation). Idempotent: a no-op when schema_version is already >= 2.
 *
 * Legacy keys (`workspace_configs`, `workspaces`, `activeWorkspaceId`,
 * `workspace_notes_*`, `local_scripts_*`) are intentionally preserved by the
 * backend so a rollback is possible during the foundation milestone.
 */
export async function runMigration(
  settings: Settings
): Promise<MigrationReport> {
  const before = await getSchemaVersion();
  if (before >= HEROI_SCHEMA_VERSION) {
    return {
      alreadyMigrated: true,
      schemaVersionBefore: before,
      schemaVersionAfter: before,
      projectsWritten: 0,
      conversationsWritten: 0,
    };
  }

  const [repos, legacyWorkspaces] = await Promise.all([
    listRepos().catch(() => [] as RepoEntry[]),
    listWorkspaceConfigs().catch(() => [] as WorkspaceConfig[]),
  ]);

  const projects = await buildProjects(repos);
  const defaultAgentId = settings.defaultAgentId || "shell";
  const conversations: Conversation[] = legacyWorkspaces
    .map((ws) => conversationFromWorkspace(ws, projects, defaultAgentId))
    .filter((c): c is Conversation => c !== null);

  const payload: MigrationPayloadV2 = {
    schemaVersion: HEROI_SCHEMA_VERSION,
    projects,
    conversations,
  };

  await migrateToV2(payload);

  return {
    alreadyMigrated: false,
    schemaVersionBefore: before,
    schemaVersionAfter: HEROI_SCHEMA_VERSION,
    projectsWritten: projects.length,
    conversationsWritten: conversations.length,
  };
}
