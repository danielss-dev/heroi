import { useEffect, useState } from "react";
import { Play, Settings } from "lucide-react";
import type { Conversation, Project, ProjectCommand } from "../../types";
import { useCommandsStore } from "../../stores/useCommandsStore";
import { RunCommandDialog } from "./RunCommandDialog";
import { CommandsEditor } from "./CommandsEditor";

interface Props {
  conversation: Conversation;
  project: Project;
  onClose: () => void;
}

export function CommandQuickList({ conversation, project, onClose }: Props) {
  const commands = useCommandsStore((s) => s.forProject(project.id));
  const load = useCommandsStore((s) => s.load);
  const [picked, setPicked] = useState<ProjectCommand | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void load(project.id);
  }, [project.id, load]);

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1">
        {commands.length === 0 ? (
          <div className="px-3 py-2 text-xs text-zinc-500">
            No commands defined for this project yet.
          </div>
        ) : (
          commands.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setPicked(c);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 flex items-start gap-2"
            >
              <Play
                size={11}
                className="mt-0.5 text-zinc-500 group-hover:text-zinc-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-zinc-100">{c.name}</div>
                {c.description && (
                  <div className="text-[10px] text-zinc-500 truncate">
                    {c.description}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
        <div className="border-t border-zinc-800 mt-1 pt-1">
          <button
            onClick={() => {
              setEditing(true);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-400 hover:text-zinc-200"
          >
            <Settings size={11} />
            Edit commands…
          </button>
        </div>
      </div>

      {picked && (
        <RunCommandDialog
          open={true}
          onClose={() => setPicked(null)}
          conversation={conversation}
          command={picked}
        />
      )}

      <CommandsEditor
        open={editing}
        onClose={() => setEditing(false)}
        project={project}
      />
    </>
  );
}
