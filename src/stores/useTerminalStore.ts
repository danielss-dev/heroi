import { create } from "zustand";

export interface PtySession {
  id: string;
  workspaceId: string;
  worktreePath: string;
  agentId: string;
  pid: number;
  status: "running" | "exited";
}

interface TerminalState {
  // Sessions keyed by workspaceId, each workspace can have multiple sessions
  sessions: Record<string, PtySession[]>;
  activeSessionId: string | null;

  addSession: (workspaceId: string, session: PtySession) => void;
  removeSession: (workspaceId: string, sessionId: string) => void;
  setActiveSession: (id: string | null) => void;
  updateSessionStatus: (
    workspaceId: string,
    sessionId: string,
    status: "running" | "exited"
  ) => void;
  getSessionsForWorkspace: (workspaceId: string) => PtySession[];
  hasRunningSession: (workspaceId: string) => boolean;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: {},
  activeSessionId: null,

  addSession: (workspaceId, session) =>
    set((s) => {
      const existing = s.sessions[workspaceId] ?? [];
      return {
        sessions: {
          ...s.sessions,
          [workspaceId]: [...existing, session],
        },
        activeSessionId: session.id,
      };
    }),

  removeSession: (workspaceId, sessionId) =>
    set((s) => {
      const sessions = (s.sessions[workspaceId] ?? []).filter(
        (sess) => sess.id !== sessionId
      );
      return {
        sessions: { ...s.sessions, [workspaceId]: sessions },
        activeSessionId:
          s.activeSessionId === sessionId ? null : s.activeSessionId,
      };
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  updateSessionStatus: (workspaceId, sessionId, status) =>
    set((s) => {
      const sessions = (s.sessions[workspaceId] ?? []).map((sess) =>
        sess.id === sessionId ? { ...sess, status } : sess
      );
      return {
        sessions: { ...s.sessions, [workspaceId]: sessions },
      };
    }),

  getSessionsForWorkspace: (workspaceId) => {
    return get().sessions[workspaceId] ?? [];
  },

  hasRunningSession: (workspaceId) => {
    const sessions = get().sessions[workspaceId] ?? [];
    return sessions.some((s) => s.status === "running");
  },
}));
