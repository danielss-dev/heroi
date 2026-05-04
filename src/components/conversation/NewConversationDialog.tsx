import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, GitBranch, FolderGit2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useProjectStore } from "../../stores/useProjectStore";
import { useConversationStore } from "../../stores/useConversationStore";
import { useAppStore } from "../../stores/useAppStore";
import {
  createConversation,
  type WorkingDirChoice,
} from "../../lib/tauri";
import type { Project, Conversation } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project;
  onCreated?: (conversation: Conversation) => void;
}

type WorkingDirKindUI = "primary" | "worktree";

function shortRandom() {
  return Math.random().toString(36).slice(2, 8);
}

function defaultBranchName(agentId: string) {
  return `${agentId === "shell" ? "session" : agentId}/${shortRandom()}`;
}

export function NewConversationDialog({
  open,
  onClose,
  project,
  onCreated,
}: Props) {
  const agents = useAppStore((s) => s.agents);
  const settings = useAppStore((s) => s.settings);
  const upsertConversation = useConversationStore((s) => s.upsertConversation);
  const setSelected = useConversationStore((s) => s.setSelected);
  const setExpanded = useProjectStore((s) => s.setExpanded);
  const conversationsSharingPrimary = useConversationStore(
    (s) => s.conversationsSharingPrimary
  );

  const [agentId, setAgentId] = useState(settings.defaultAgentId);
  const [workingDirKind, setWorkingDirKind] =
    useState<WorkingDirKindUI>("primary");
  const [branchName, setBranchName] = useState(defaultBranchName(agentId));
  const [baseBranch, setBaseBranch] = useState(project.defaultBaseBranch);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields when the dialog opens for a different project.
  useEffect(() => {
    if (!open) return;
    setAgentId(settings.defaultAgentId);
    setWorkingDirKind("primary");
    setBranchName(defaultBranchName(settings.defaultAgentId));
    setBaseBranch(project.defaultBaseBranch);
    setName("");
    setError(null);
  }, [open, project.id, project.defaultBaseBranch, settings.defaultAgentId]);

  const agentDef = agents.find((a) => a.id === agentId);

  const sharingPrimary = useMemo(
    () => conversationsSharingPrimary(project.id),
    [conversationsSharingPrimary, project.id]
  );

  const showSharedPrimaryWarning =
    workingDirKind === "primary" && sharingPrimary.length > 0;

  const handleAgentChange = (next: string) => {
    setAgentId(next);
    // Refresh the suggested branch name to reflect the agent
    if (workingDirKind === "worktree") {
      setBranchName(defaultBranchName(next));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const finalName =
      name.trim() ||
      (workingDirKind === "worktree"
        ? branchName.trim() || `${agentId}-${shortRandom()}`
        : `${agentId}-${shortRandom()}`);

    const choice: WorkingDirChoice =
      workingDirKind === "primary"
        ? { kind: "primary" }
        : {
            kind: "worktree",
            branchName: branchName.trim() || defaultBranchName(agentId),
            baseBranch: baseBranch.trim() || undefined,
          };

    try {
      const conv = await createConversation(
        project.id,
        finalName,
        agentId,
        choice
      );
      upsertConversation(conv);
      setSelected(conv.id);
      setExpanded(project.id, true);
      onCreated?.(conv);
      onClose();
    } catch (err) {
      console.error(err);
      setError(typeof err === "string" ? err : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New conversation" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
        <div>
          <div className="text-zinc-400 mb-1 text-xs uppercase tracking-wider">
            Project
          </div>
          <div className="text-zinc-100">{project.name}</div>
        </div>

        <div>
          <label className="text-zinc-400 mb-1 text-xs uppercase tracking-wider block">
            Agent
          </label>
          <select
            value={agentId}
            onChange={(e) => handleAgentChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {agentDef && (
            <p className="text-xs text-zinc-500 mt-1">{agentDef.description}</p>
          )}
        </div>

        <div>
          <div className="text-zinc-400 mb-1 text-xs uppercase tracking-wider">
            Mode
          </div>
          <div className="flex gap-2">
            <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-indigo-500 bg-indigo-500/10 cursor-pointer">
              <input type="radio" checked readOnly className="accent-indigo-500" />
              <span className="text-zinc-100">Chat</span>
            </label>
            <label
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-zinc-800 bg-zinc-900 opacity-60 cursor-not-allowed"
              title="Coming in milestone 2"
            >
              <input type="radio" disabled className="accent-zinc-500" />
              <span className="text-zinc-500">Kanban</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-500">
                Soon
              </span>
            </label>
          </div>
        </div>

        <div>
          <div className="text-zinc-400 mb-1 text-xs uppercase tracking-wider">
            Working directory
          </div>
          <div className="flex flex-col gap-2">
            <label
              className={`flex items-start gap-2 px-3 py-2 rounded border cursor-pointer ${
                workingDirKind === "primary"
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="workingDir"
                checked={workingDirKind === "primary"}
                onChange={() => setWorkingDirKind("primary")}
                className="accent-indigo-500 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-zinc-100">
                  <FolderGit2 size={13} />
                  Primary checkout
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 truncate">
                  {project.primaryCheckoutPath}
                </div>
                {showSharedPrimaryWarning && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-400">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {sharingPrimary.length} other conversation
                      {sharingPrimary.length === 1 ? "" : "s"} already targeting
                      this checkout. Concurrent edits may collide.
                    </span>
                  </div>
                )}
              </div>
            </label>

            <label
              className={`flex items-start gap-2 px-3 py-2 rounded border cursor-pointer ${
                workingDirKind === "worktree"
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="workingDir"
                checked={workingDirKind === "worktree"}
                onChange={() => setWorkingDirKind("worktree")}
                className="accent-indigo-500 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-zinc-100">
                  <GitBranch size={13} />
                  New worktree on its own branch
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Isolated checkout for parallel work.
                </div>

                {workingDirKind === "worktree" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                        Branch name
                      </label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                        Base branch
                      </label>
                      <input
                        type="text"
                        value={baseBranch}
                        onChange={(e) => setBaseBranch(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="text-zinc-400 mb-1 text-xs uppercase tracking-wider block">
            Conversation name <span className="text-zinc-600">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${agentId}-${shortRandom()}`}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm"
            spellCheck={false}
          />
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-400 text-white rounded font-medium"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
