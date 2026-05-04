import { create } from "zustand";
import { listProjects } from "../lib/tauri";
import type { Project } from "../types";

interface ProjectStoreState {
  projects: Project[];
  activeProjectId: string | null;
  expandedProjectIds: Set<string>;
  loaded: boolean;

  setProjects: (projects: Project[]) => void;
  setActiveProjectId: (id: string | null) => void;
  upsertProject: (project: Project) => void;
  removeProject: (id: string) => void;
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;

  refresh: () => Promise<void>;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  expandedProjectIds: new Set(),
  loaded: false,

  setProjects: (projects) => set({ projects, loaded: true }),

  setActiveProjectId: (id) => set({ activeProjectId: id }),

  upsertProject: (project) =>
    set((s) => {
      const idx = s.projects.findIndex((p) => p.id === project.id);
      const next =
        idx === -1
          ? [...s.projects, project]
          : s.projects.map((p) => (p.id === project.id ? project : p));
      return { projects: next };
    }),

  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
      expandedProjectIds: (() => {
        const next = new Set(s.expandedProjectIds);
        next.delete(id);
        return next;
      })(),
    })),

  toggleExpanded: (id) =>
    set((s) => {
      const next = new Set(s.expandedProjectIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { expandedProjectIds: next };
    }),

  setExpanded: (id, expanded) =>
    set((s) => {
      const next = new Set(s.expandedProjectIds);
      if (expanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return { expandedProjectIds: next };
    }),

  refresh: async () => {
    try {
      const projects = await listProjects();
      set({ projects, loaded: true });
      // If exactly one project and nothing active, auto-select it for convenience.
      if (projects.length === 1 && !get().activeProjectId) {
        set({ activeProjectId: projects[0].id });
      }
    } catch (err) {
      console.error("[heroi] failed to load projects", err);
    }
  },
}));
