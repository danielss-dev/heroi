import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { spawn } from "tauri-pty";
import type { IPty } from "tauri-pty";
import "@xterm/xterm/css/xterm.css";
import { useAppStore } from "../../stores/useAppStore";
import { getAgentById, getAgentArgs } from "../../lib/agents";

// ---------------------------------------------------------------------------
// Multi-session terminal architecture
// ---------------------------------------------------------------------------

interface TerminalSession {
  key: string; // worktree path
  worktreePath: string;
  agentId: string;
  pty: IPty | null;
  terminal: Terminal;
  fitAddon: FitAddon;
  containerEl: HTMLDivElement;
  disposers: Array<{ dispose: () => void }>;
  status: "running" | "exited";
}

const sessions = new Map<string, TerminalSession>();
let activeSessionKey: string | null = null;

const TERM_OPTIONS = {
  cursorBlink: true,
  convertEol: true,
  fontSize: 13,
  fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
  theme: {
    background: "#09090b",
    foreground: "#e4e4e7",
    cursor: "#e4e4e7",
    selectionBackground: "#6366f140",
    black: "#18181b",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#eab308",
    blue: "#6366f1",
    magenta: "#a855f7",
    cyan: "#06b6d4",
    white: "#e4e4e7",
    brightBlack: "#52525b",
    brightRed: "#f87171",
    brightGreen: "#4ade80",
    brightYellow: "#facc15",
    brightBlue: "#818cf8",
    brightMagenta: "#c084fc",
    brightCyan: "#22d3ee",
    brightWhite: "#fafafa",
  },
  allowProposedApi: true,
} as const;

// ---------------------------------------------------------------------------
// Session lifecycle helpers
// ---------------------------------------------------------------------------

function createSession(worktreePath: string, parentEl: HTMLDivElement): TerminalSession {
  const containerEl = document.createElement("div");
  containerEl.style.position = "absolute";
  containerEl.style.inset = "0";
  containerEl.style.display = "none"; // hidden until showSession
  parentEl.appendChild(containerEl);

  const terminal = new Terminal(TERM_OPTIONS);
  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.open(containerEl);

  const session: TerminalSession = {
    key: worktreePath,
    worktreePath,
    agentId: "",
    pty: null,
    terminal,
    fitAddon,
    containerEl,
    disposers: [],
    status: "exited",
  };

  sessions.set(worktreePath, session);
  return session;
}

function showSession(key: string) {
  // Hide all session containers
  for (const [k, s] of sessions) {
    s.containerEl.style.display = k === key ? "" : "none";
  }

  activeSessionKey = key;

  const session = sessions.get(key);
  if (session) {
    requestAnimationFrame(() => {
      try {
        session.fitAddon.fit();
      } catch {
        /* ignore */
      }
      session.terminal.focus();
    });
  }
}

function killSessionPty(session: TerminalSession) {
  session.disposers.forEach((d) => {
    try {
      d.dispose();
    } catch {
      /* ignore */
    }
  });
  session.disposers = [];

  if (session.pty !== null) {
    try {
      session.pty.kill();
    } catch {
      /* ignore */
    }
    session.pty = null;
  }
  session.status = "exited";
}

function spawnInSession(
  session: TerminalSession,
  command: string,
  args: string[],
  agentId: string
) {
  killSessionPty(session);
  session.terminal.clear();
  session.terminal.reset();
  session.agentId = agentId;

  try {
    const pty = spawn(command, args, {
      cols: session.terminal.cols,
      rows: session.terminal.rows,
      cwd: session.worktreePath,
      env: { TERM: "xterm-256color" },
    });

    session.pty = pty;
    session.status = "running";

    // PTY output -> Terminal
    const dataDisp = pty.onData((data) => {
      session.terminal.write(new Uint8Array(data));
    });
    session.disposers.push(dataDisp);

    // PTY exit
    const exitDisp = pty.onExit(({ exitCode }) => {
      session.terminal.write(
        `\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`
      );
      if (session.pty === pty) {
        session.pty = null;
        session.status = "exited";
      }
    });
    session.disposers.push(exitDisp);

    // Terminal input -> PTY
    const inputDisp = session.terminal.onData((data) => {
      pty.write(data);
    });
    session.disposers.push(inputDisp);

    // Terminal resize -> PTY
    const resizeDisp = session.terminal.onResize((e) => {
      pty.resize(e.cols, e.rows);
    });
    session.disposers.push(resizeDisp);

    session.terminal.focus();
  } catch (err) {
    session.terminal.write(
      `\x1b[31mFailed to spawn "${command}": ${err}\x1b[0m\r\n`
    );
    session.terminal.write(
      `\x1b[90mMake sure "${command}" is installed and in your PATH.\x1b[0m\r\n`
    );
    session.status = "exited";
  }
}

function destroySession(key: string) {
  const session = sessions.get(key);
  if (!session) return;
  killSessionPty(session);
  session.terminal.dispose();
  session.containerEl.remove();
  sessions.delete(key);
  if (activeSessionKey === key) activeSessionKey = null;
}

function destroyAllSessions() {
  for (const key of [...sessions.keys()]) {
    destroySession(key);
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export function XtermTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevWorktreePathRef = useRef<string | null>(null);

  const selectedWorktree = useAppStore((s) => s.selectedWorktree);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const agents = useAppStore((s) => s.agents);

  // Effect 1: ResizeObserver — fit only active session
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (activeSessionKey) {
        const session = sessions.get(activeSessionKey);
        if (session) {
          try {
            session.fitAddon.fit();
          } catch {
            /* ignore */
          }
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Effect 2: Watch selectedWorktree + selectedAgentId
  // Show existing session or create new one; respawn only if agent changed or no PTY.
  // When switching worktrees, restore the session's agent rather than respawning.
  useEffect(() => {
    const parentEl = containerRef.current;
    if (!selectedWorktree || !parentEl) return;

    const agent = getAgentById(agents, selectedAgentId);
    if (!agent) return;

    const key = selectedWorktree.path;
    const worktreeChanged = prevWorktreePathRef.current !== key;
    prevWorktreePathRef.current = key;

    let session = sessions.get(key);

    if (!session) {
      // First time visiting this worktree — create session and spawn
      session = createSession(key, parentEl);
      showSession(key);
      const settings = useAppStore.getState().settings;
      const args = getAgentArgs(agent, settings);
      spawnInSession(session, agent.command, args, selectedAgentId);
      return;
    }

    // Session exists — show it
    showSession(key);

    // If we got here because the user switched worktrees and the session
    // already has an agent running, restore the dropdown to match the
    // session's agent instead of killing the running process.
    if (worktreeChanged && session.agentId && session.agentId !== selectedAgentId) {
      useAppStore.getState().setSelectedAgentId(session.agentId);
      return;
    }

    // Respawn if the agent was explicitly changed on this worktree, or if PTY exited
    if (session.agentId !== selectedAgentId || session.pty === null) {
      const settings = useAppStore.getState().settings;
      const args = getAgentArgs(agent, settings);
      spawnInSession(session, agent.command, args, selectedAgentId);
    }
  }, [selectedWorktree, selectedAgentId, agents]);

  // Effect 3: "Run" button forces respawn in current session
  useEffect(() => {
    const handler = () => {
      const state = useAppStore.getState();
      const {
        selectedWorktree: worktree,
        selectedAgentId: agentId,
        agents: agentsList,
        settings,
      } = state;
      if (!worktree) return;

      const key = worktree.path;
      const session = sessions.get(key);
      if (!session) return;

      const agent = getAgentById(agentsList, agentId);
      if (!agent) return;

      const args = getAgentArgs(agent, settings);
      spawnInSession(session, agent.command, args, agentId);
    };

    window.addEventListener("heroi:respawn-agent", handler);
    return () => window.removeEventListener("heroi:respawn-agent", handler);
  }, []);

  // Effect 4: Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyAllSessions();
    };
  }, []);

  return (
    <div ref={containerRef} className="xterm-container flex-1 min-h-0" />
  );
}
