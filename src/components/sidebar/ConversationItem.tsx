import { Bot, FolderGit2, GitBranch, Trash2, AlertTriangle } from "lucide-react";
import type { Conversation, Project, WorktreeInfo } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { useConversationStore } from "../../stores/useConversationStore";
import { useTerminalStatus } from "../../hooks/useTerminalStatus";
import { deleteConversation } from "../../lib/tauri";

interface Props {
  conversation: Conversation;
  project: Project;
  sharedPrimaryCount: number;
}

function syntheticWorktree(c: Conversation): WorktreeInfo {
  return {
    name:
      c.workingDir.kind === "worktree"
        ? c.workingDir.worktreeName ?? c.name
        : "main",
    path: c.workingDir.path,
    branch: c.workingDir.branch ?? null,
    is_main: c.workingDir.kind === "primary",
  };
}

export function ConversationItem({
  conversation,
  project,
  sharedPrimaryCount,
}: Props) {
  const isSelected = useConversationStore(
    (s) => s.selectedConversationId === conversation.id
  );
  const setSelected = useConversationStore((s) => s.setSelected);
  const removeConversation = useConversationStore(
    (s) => s.removeConversation
  );
  const status = useTerminalStatus(conversation.id);

  const handleClick = () => {
    setSelected(conversation.id);
    // Compat: keep the legacy right panel + TopBar wired to a "worktree".
    const wt = syntheticWorktree(conversation);
    useAppStore.setState({
      selectedRepo: project.repoPath,
      selectedWorktree: wt,
    });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Delete conversation "${conversation.name}"? ${
          conversation.workingDir.kind === "worktree"
            ? "Its worktree and branch will be removed."
            : ""
        }`
      )
    ) {
      return;
    }
    try {
      await deleteConversation(conversation.id);
      removeConversation(conversation.id);
    } catch (err) {
      console.error("Delete conversation failed", err);
    }
  };

  const isWorktree = conversation.workingDir.kind === "worktree";
  const sharedPrimary = !isWorktree && sharedPrimaryCount > 1;

  return (
    <div
      onClick={handleClick}
      className={`group flex items-center gap-1.5 pl-6 pr-2 py-1 cursor-pointer text-xs ${
        isSelected
          ? "bg-indigo-500/15 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
      }`}
      title={conversation.name}
    >
      {/* Status dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          status === "running"
            ? "bg-emerald-400 animate-pulse"
            : status === "exited"
              ? "bg-zinc-600"
              : "bg-zinc-700"
        }`}
        title={status}
      />

      <Bot size={11} className="shrink-0 text-zinc-500" />

      <span className="truncate flex-1">{conversation.name}</span>

      {/* P / W chip */}
      <span
        className={`shrink-0 inline-flex items-center justify-center text-[9px] uppercase tracking-wider rounded px-1 ${
          isWorktree
            ? "bg-violet-500/20 text-violet-300"
            : "bg-zinc-700 text-zinc-300"
        }`}
        title={
          isWorktree
            ? `Worktree • ${conversation.workingDir.branch ?? "?"}`
            : `Primary checkout • ${conversation.workingDir.branch ?? "?"}`
        }
      >
        {isWorktree ? <GitBranch size={9} /> : <FolderGit2 size={9} />}
      </span>

      {sharedPrimary && (
        <AlertTriangle
          size={11}
          className="text-amber-400 shrink-0"
          aria-label="Sharing primary checkout"
        />
      )}

      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 shrink-0"
        title="Delete conversation"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}
