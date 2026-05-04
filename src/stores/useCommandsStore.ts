import { create } from "zustand";
import {
  deleteProjectCommand as apiDelete,
  listProjectCommands,
  listProjectVarAdvisory,
  upsertProjectCommand as apiUpsert,
  type UpsertProjectCommandInput,
} from "../lib/tauri";
import type {
  ProjectCommand,
  ProjectVariableAdvisoryEntry,
} from "../types";

interface CommandsStoreState {
  commandsByProject: Record<string, ProjectCommand[]>;
  advisoryByProject: Record<string, ProjectVariableAdvisoryEntry[]>;
  loadedCommandsForProject: Set<string>;
  loadedAdvisoryForProject: Set<string>;

  load: (projectId: string) => Promise<ProjectCommand[]>;
  loadAdvisory: (
    projectId: string
  ) => Promise<ProjectVariableAdvisoryEntry[]>;
  reloadAdvisory: (
    projectId: string
  ) => Promise<ProjectVariableAdvisoryEntry[]>;

  upsert: (input: UpsertProjectCommandInput) => Promise<ProjectCommand>;
  remove: (projectId: string, commandId: string) => Promise<void>;

  forProject: (projectId: string) => ProjectCommand[];
  advisoryFor: (projectId: string) => ProjectVariableAdvisoryEntry[];
}

function withLoaded<K extends "loadedCommandsForProject" | "loadedAdvisoryForProject">(
  state: CommandsStoreState,
  key: K,
  projectId: string
): Pick<CommandsStoreState, K> {
  const next = new Set(state[key]);
  next.add(projectId);
  return { [key]: next } as Pick<CommandsStoreState, K>;
}

export const useCommandsStore = create<CommandsStoreState>((set, get) => ({
  commandsByProject: {},
  advisoryByProject: {},
  loadedCommandsForProject: new Set(),
  loadedAdvisoryForProject: new Set(),

  load: async (projectId) => {
    if (get().loadedCommandsForProject.has(projectId)) {
      return get().commandsByProject[projectId] ?? [];
    }
    const list = await listProjectCommands(projectId);
    set((s) => ({
      commandsByProject: { ...s.commandsByProject, [projectId]: list },
      ...withLoaded(s, "loadedCommandsForProject", projectId),
    }));
    return list;
  },

  loadAdvisory: async (projectId) => {
    if (get().loadedAdvisoryForProject.has(projectId)) {
      return get().advisoryByProject[projectId] ?? [];
    }
    const list = await listProjectVarAdvisory(projectId);
    set((s) => ({
      advisoryByProject: { ...s.advisoryByProject, [projectId]: list },
      ...withLoaded(s, "loadedAdvisoryForProject", projectId),
    }));
    return list;
  },

  reloadAdvisory: async (projectId) => {
    const list = await listProjectVarAdvisory(projectId);
    set((s) => ({
      advisoryByProject: { ...s.advisoryByProject, [projectId]: list },
      ...withLoaded(s, "loadedAdvisoryForProject", projectId),
    }));
    return list;
  },

  upsert: async (input) => {
    const cmd = await apiUpsert(input);
    set((s) => {
      const existing = s.commandsByProject[cmd.projectId] ?? [];
      const idx = existing.findIndex((c) => c.id === cmd.id);
      const next =
        idx === -1
          ? [...existing, cmd]
          : existing.map((c) => (c.id === cmd.id ? cmd : c));
      return {
        commandsByProject: { ...s.commandsByProject, [cmd.projectId]: next },
      };
    });
    return cmd;
  },

  remove: async (projectId, commandId) => {
    await apiDelete(commandId);
    set((s) => {
      const existing = s.commandsByProject[projectId] ?? [];
      return {
        commandsByProject: {
          ...s.commandsByProject,
          [projectId]: existing.filter((c) => c.id !== commandId),
        },
      };
    });
  },

  forProject: (projectId) => get().commandsByProject[projectId] ?? [],
  advisoryFor: (projectId) => get().advisoryByProject[projectId] ?? [],
}));
