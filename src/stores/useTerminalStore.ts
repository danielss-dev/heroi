import { create } from "zustand";

export interface PtySession {
  id: string;
  worktreePath: string;
  agentId: string;
  pid: number;
  status: "running" | "exited";
}

interface TerminalState {
  sessions: Record<string, PtySession>; // keyed by worktree path
  activeSessionId: string | null;

  setSession: (worktreePath: string, session: PtySession) => void;
  removeSession: (worktreePath: string) => void;
  setActiveSession: (id: string | null) => void;
  updateSessionStatus: (
    worktreePath: string,
    status: "running" | "exited"
  ) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: {},
  activeSessionId: null,

  setSession: (worktreePath, session) =>
    set((s) => ({
      sessions: { ...s.sessions, [worktreePath]: session },
      activeSessionId: session.id,
    })),
  removeSession: (worktreePath) =>
    set((s) => {
      const { [worktreePath]: _, ...rest } = s.sessions;
      return { sessions: rest };
    }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  updateSessionStatus: (worktreePath, status) =>
    set((s) => {
      const session = s.sessions[worktreePath];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [worktreePath]: { ...session, status },
        },
      };
    }),
}));
