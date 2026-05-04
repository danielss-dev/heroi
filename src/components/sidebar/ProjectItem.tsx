import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import type { Project } from "../../types";
import { useProjectStore } from "../../stores/useProjectStore";
import { useConversationStore } from "../../stores/useConversationStore";
import { ConversationItem } from "./ConversationItem";
import { NewConversationDialog } from "../conversation/NewConversationDialog";
import { CommandsEditor } from "../commands/CommandsEditor";
import { deleteProject } from "../../lib/tauri";

interface Props {
  project: Project;
}

export function ProjectItem({ project }: Props) {
  const expanded = useProjectStore((s) =>
    s.expandedProjectIds.has(project.id)
  );
  const toggleExpanded = useProjectStore((s) => s.toggleExpanded);
  const removeProject = useProjectStore((s) => s.removeProject);
  const setExpanded = useProjectStore((s) => s.setExpanded);
  const conversations = useConversationStore((s) =>
    s.conversations.filter((c) => c.projectId === project.id && !c.archivedAt)
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);

  const sharedPrimaryCount = conversations.filter(
    (c) => c.workingDir.kind === "primary"
  ).length;

  const handleNewConversation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogOpen(true);
    setExpanded(project.id, true);
  };

  const handleEditCommands = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommandsOpen(true);
  };

  const handleDeleteProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversations.length > 0) {
      window.alert(
        `Project "${project.name}" still has ${conversations.length} conversation(s). Delete those first.`
      );
      return;
    }
    if (!window.confirm(`Remove project "${project.name}" from heroi?`)) return;
    try {
      await deleteProject(project.id);
      removeProject(project.id);
    } catch (err) {
      console.error("Delete project failed", err);
      window.alert(typeof err === "string" ? err : (err as Error).message);
    }
  };

  return (
    <>
      <div className="group">
        <div
          onClick={() => toggleExpanded(project.id)}
          className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-zinc-800/60"
          title={project.repoPath}
        >
          {expanded ? (
            <ChevronDown size={12} className="text-zinc-500 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-zinc-500 shrink-0" />
          )}
          <span className="flex-1 truncate text-xs font-medium text-zinc-200">
            {project.name}
          </span>
          <button
            onClick={handleEditCommands}
            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-100 p-0.5 rounded"
            title="Edit commands"
          >
            <Wrench size={11} />
          </button>
          <button
            onClick={handleNewConversation}
            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-100 p-0.5 rounded"
            title="New conversation"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={handleDeleteProject}
            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-0.5 rounded"
            title="Remove project"
          >
            <Trash2 size={11} />
          </button>
        </div>

        {expanded && (
          <div>
            {conversations.length === 0 ? (
              <div className="pl-6 pr-2 py-1 text-[11px] text-zinc-600 italic">
                No conversations yet.
              </div>
            ) : (
              conversations.map((c) => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  project={project}
                  sharedPrimaryCount={sharedPrimaryCount}
                />
              ))
            )}
          </div>
        )}
      </div>

      <NewConversationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        project={project}
      />

      <CommandsEditor
        open={commandsOpen}
        onClose={() => setCommandsOpen(false)}
        project={project}
      />
    </>
  );
}
