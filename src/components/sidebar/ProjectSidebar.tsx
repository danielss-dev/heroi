import { useState } from "react";
import { Settings, Workflow, Plus } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../../stores/useProjectStore";
import { useOrchestrateStore } from "../../stores/useOrchestrateStore";
import { ProjectItem } from "./ProjectItem";
import { SettingsModal } from "../settings/SettingsModal";
import { addProject } from "../../lib/tauri";
import heroiLogo from "/heroilogo.png";

export function ProjectSidebar() {
  const projects = useProjectStore((s) => s.projects);
  const upsertProject = useProjectStore((s) => s.upsertProject);
  const setExpanded = useProjectStore((s) => s.setExpanded);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleAddProject = async () => {
    if (adding) return;
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Select Git Repository",
    });
    if (!selected) return;
    setAdding(true);
    try {
      const project = await addProject(selected as string);
      upsertProject(project);
      setExpanded(project.id, true);
    } catch (err) {
      console.error("Add project failed", err);
      window.alert(typeof err === "string" ? err : (err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel-bg)] border-r border-[var(--color-panel-border)]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-panel-border)]">
        <img src={heroiLogo} alt="Heroi" className="w-4 h-4" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Heroi
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 ? (
          <div className="px-3 py-4 text-xs text-zinc-500 leading-relaxed">
            No projects yet. Click <span className="text-zinc-300">Add project</span>{" "}
            below to register a Git repository.
          </div>
        ) : (
          projects.map((p) => <ProjectItem key={p.id} project={p} />)
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-[var(--color-panel-border)] p-1.5">
        <button
          onClick={handleAddProject}
          disabled={adding}
          className="flex items-center gap-1.5 flex-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
        >
          <Plus size={14} />
          Add project
        </button>
        <button
          onClick={() => {
            useOrchestrateStore.getState().setShowOrchestrateView(true);
          }}
          className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="Orchestrate"
        >
          <Workflow size={16} />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
