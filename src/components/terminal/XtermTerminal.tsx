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
// Multi-session terminal architecture (keyed by tabId)
// ---------------------------------------------------------------------------

interface TerminalSession {
  key: string; // tabId
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

function createSession(
  tabId: string,
  worktreePath: string,
  parentEl: HTMLDivElement
): TerminalSession {
  const containerEl = document.createElement("div");
  containerEl.style.position = "absolute";
  containerEl.style.inset = "0";
  containerEl.style.overflow = "hidden";
  containerEl.style.display = "none";
  parentEl.appendChild(containerEl);

  const terminal = new Terminal(TERM_OPTIONS);
  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.open(containerEl);

  const session: TerminalSession = {
    key: tabId,
    worktreePath,
    agentId: "",
    pty: null,
    terminal,
    fitAddon,
    containerEl,
    disposers: [],
    status: "exited",
  };

  sessions.set(tabId, session);
  return session;
}

function showSession(key: string) {
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

function getActiveWorkspaceEnv(): Record<string, string> {
  const state = useAppStore.getState();
  const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
  return ws?.envVars ?? {};
}

function getProviderEnv(): Record<string, string> {
  const state = useAppStore.getState();
  const providers = state.settings.providers ?? [];
  const env: Record<string, string> = {};
  for (const provider of providers) {
    if (provider.enabled && provider.apiKey) {
      env[provider.envVarName] = provider.apiKey;
      if (provider.baseUrl) {
        // Set base URL env var (convention: <PROVIDER>_BASE_URL)
        const baseUrlKey = provider.envVarName.replace(/_API_KEY$/, "_BASE_URL");
        if (baseUrlKey !== provider.envVarName) {
          env[baseUrlKey] = provider.baseUrl;
        }
      }
    }
  }
  return env;
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

  const workspaceEnv = getActiveWorkspaceEnv();
  const providerEnv = getProviderEnv();

  try {
    const pty = spawn(command, args, {
      cols: session.terminal.cols,
      rows: session.terminal.rows,
      cwd: session.worktreePath,
      env: { TERM: "xterm-256color", ...providerEnv, ...workspaceEnv },
    });

    session.pty = pty;
    session.status = "running";

    const dataDisp = pty.onData((data) => {
      session.terminal.write(new Uint8Array(data));
    });
    session.disposers.push(dataDisp);

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

    const inputDisp = session.terminal.onData((data) => {
      pty.write(data);
    });
    session.disposers.push(inputDisp);

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

export function getSessionStatus(key: string): "running" | "exited" | null {
  const session = sessions.get(key);
  if (!session) return null;
  return session.status;
}

export function destroySession(key: string) {
  const session = sessions.get(key);
  if (!session) return;
  killSessionPty(session);
  session.terminal.dispose();
  session.containerEl.remove();
  sessions.delete(key);
  if (activeSessionKey === key) activeSessionKey = null;
}

export function destroyAllSessions() {
  for (const key of [...sessions.keys()]) {
    destroySession(key);
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export function XtermTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedWorktree = useAppStore((s) => s.selectedWorktree);
  const agents = useAppStore((s) => s.agents);
  const worktreeTabs = useAppStore((s) => s.worktreeTabs);
  const activeTabId = useAppStore((s) => s.activeTabId);

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

  // Effect 2: Watch selectedWorktree + activeTabId
  // Show existing session or create new one; spawn agent for the active tab.
  useEffect(() => {
    const parentEl = containerRef.current;
    if (!selectedWorktree || !parentEl) return;

    const worktreePath = selectedWorktree.path;
    const currentTabId = activeTabId[worktreePath];

    if (!currentTabId) {
      // No tabs yet for this worktree — auto-create a Shell tab
      const store = useAppStore.getState();
      const shellAgent = agents.find((a) => a.id === "shell");
      if (shellAgent) {
        store.addTab(worktreePath, "shell", "Shell");
      }
      return;
    }

    const tabs = worktreeTabs[worktreePath] ?? [];
    const activeTab = tabs.find((t) => t.id === currentTabId);
    if (!activeTab) return;

    const agent = getAgentById(agents, activeTab.agentId);
    if (!agent) return;

    let session = sessions.get(currentTabId);

    if (!session) {
      // First time visiting this tab — create session and spawn
      session = createSession(currentTabId, worktreePath, parentEl);
      showSession(currentTabId);
      const settings = useAppStore.getState().settings;
      const args = getAgentArgs(agent, settings);
      spawnInSession(session, agent.command, args, activeTab.agentId);
      return;
    }

    // Session exists — show it
    showSession(currentTabId);

    // Respawn if PTY exited
    if (session.pty === null) {
      const settings = useAppStore.getState().settings;
      const args = getAgentArgs(agent, settings);
      spawnInSession(session, agent.command, args, activeTab.agentId);
    }
  }, [selectedWorktree, activeTabId, worktreeTabs, agents]);

  // Effect 2b: Listen for panel resize events (fired by AppLayout during drag)
  useEffect(() => {
    const handler = () => {
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
    };
    window.addEventListener("heroi:panel-resize", handler);
    return () => window.removeEventListener("heroi:panel-resize", handler);
  }, []);

  // Effect 3: "Run" button forces respawn in current session
  useEffect(() => {
    const handler = () => {
      const state = useAppStore.getState();
      const { selectedWorktree: worktree, agents: agentsList, settings } = state;
      if (!worktree) return;

      const worktreePath = worktree.path;
      const currentTabId = state.activeTabId[worktreePath];
      if (!currentTabId) return;

      const tabs = state.worktreeTabs[worktreePath] ?? [];
      const activeTab = tabs.find((t) => t.id === currentTabId);
      if (!activeTab) return;

      const session = sessions.get(currentTabId);
      if (!session) return;

      const agent = getAgentById(agentsList, activeTab.agentId);
      if (!agent) return;

      const args = getAgentArgs(agent, settings);
      spawnInSession(session, agent.command, args, activeTab.agentId);
    };

    window.addEventListener("heroi:respawn-agent", handler);
    return () => window.removeEventListener("heroi:respawn-agent", handler);
  }, []);

  // Effect 4: Listen for destroy-all-sessions (workspace switching)
  useEffect(() => {
    const handler = () => destroyAllSessions();
    window.addEventListener("heroi:destroy-all-sessions", handler);
    return () =>
      window.removeEventListener("heroi:destroy-all-sessions", handler);
  }, []);

  // Effect 5: Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyAllSessions();
    };
  }, []);

  return (
    <div ref={containerRef} className="xterm-container flex-1 min-h-0 min-w-0" />
  );
}
