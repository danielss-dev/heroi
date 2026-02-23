import { useState } from "react";
import { GitBranch, Pencil, Archive, Trash2 } from "lucide-react";
import type { Workspace } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { WorkspaceStatusBadge } from "../workspace/WorkspaceStatusBadge";

interface WorkspaceItemProps {
  workspace: Workspace;
  onSwitch: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceItem({
  workspace,
  onSwitch,
  onRename,
  onArchive,
  onDelete,
}: WorkspaceItemProps) {
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const totalActive = useAppStore(
    (s) => s.workspaces.filter((w) => w.status === "active").length
  );
  const isActive = workspace.id === activeWorkspaceId;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setEditName(workspace.name);
  };

  const handleRename = () => {
    if (editName.trim() && editName.trim() !== workspace.name) {
      onRename(workspace.id, editName.trim());
    }
    setEditing(false);
  };

  return (
    <div
      onClick={() => onSwitch(workspace.id)}
      className={`group flex items-center gap-2 pl-8 pr-2 py-1 text-xs cursor-pointer transition-colors ${
        isActive
          ? "bg-indigo-500/15 text-indigo-300"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
      }`}
    >
      {editing ? (
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={handleRename}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/50"
          autoFocus
        />
      ) : (
        <>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
          )}
          <WorkspaceStatusBadge workspaceId={workspace.id} />
          <span className="truncate flex-1">{workspace.name}</span>
          {workspace.branch && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-600 shrink-0">
              <GitBranch size={8} />
              <span className="truncate max-w-[60px]">{workspace.branch}</span>
            </span>
          )}
          <button
            onClick={handleStartRename}
            className="p-0.5 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100"
            title="Rename"
          >
            <Pencil size={10} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive(workspace.id);
            }}
            className="p-0.5 text-zinc-500 hover:text-amber-400 opacity-0 group-hover:opacity-100"
            title="Archive workspace"
          >
            <Archive size={10} />
          </button>
          {totalActive > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(workspace.id);
              }}
              className="p-0.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
              title="Delete workspace"
            >
              <Trash2 size={10} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
