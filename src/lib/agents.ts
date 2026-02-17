import type { AgentDef, Settings, ShellType } from "../types";

// Resolve a ShellType to the actual command + base args for spawning
function resolveShell(shellType: ShellType): { command: string; args: string[] } {
  switch (shellType) {
    case "powershell":
      return { command: "powershell.exe", args: ["-NoLogo"] };
    case "cmd":
      return { command: "cmd.exe", args: [] };
    case "bash":
      return { command: "bash", args: [] };
    case "zsh":
      return { command: "zsh", args: [] };
    case "fish":
      return { command: "fish", args: [] };
    case "sh":
      return { command: "sh", args: [] };
    default:
      return { command: "bash", args: [] };
  }
}

// Build the agent command that wraps a tool invocation inside the configured shell
function agentShellArgs(shell: { command: string; args: string[] }, toolCommand: string): string[] {
  // On Windows shells, use -Command flag
  if (shell.command === "powershell.exe") {
    return [...shell.args, "-Command", toolCommand];
  }
  if (shell.command === "cmd.exe") {
    return [...shell.args, "/c", toolCommand];
  }
  // Unix shells: use -c flag
  return [...shell.args, "-c", toolCommand];
}

export function buildAgents(shellType: ShellType): AgentDef[] {
  const shell = resolveShell(shellType);
  return [
    {
      id: "claude",
      name: "Claude Code",
      command: shell.command,
      args: agentShellArgs(shell, "claude"),
      description: "Anthropic Claude Code CLI agent",
    },
    {
      id: "codex",
      name: "Codex",
      command: shell.command,
      args: agentShellArgs(shell, "codex"),
      description: "OpenAI Codex CLI agent",
    },
    {
      id: "gemini",
      name: "Gemini CLI",
      command: shell.command,
      args: agentShellArgs(shell, "gemini"),
      description: "Google Gemini CLI agent",
    },
    {
      id: "aider",
      name: "Aider",
      command: shell.command,
      args: agentShellArgs(shell, "aider"),
      description: "Aider AI pair programming tool",
    },
    {
      id: "shell",
      name: "Shell",
      command: shell.command,
      args: [...shell.args],
      description: "Plain terminal shell",
    },
  ];
}

// Fallback agent definitions (used before settings are loaded)
export const DEFAULT_AGENTS: AgentDef[] = buildAgents(
  navigator.platform.includes("Win") ? "powershell" : "zsh"
);

export function getAgentById(
  agents: AgentDef[],
  id: string
): AgentDef | undefined {
  return agents.find((a) => a.id === id);
}

export function getAgentArgs(agent: AgentDef, settings: Settings): string[] {
  const config = settings.agentArgs[agent.id];
  if (!config) return agent.args;

  const flagArgs = Object.entries(config.flags)
    .filter(([, enabled]) => enabled)
    .map(([flag]) => flag);

  const extraArgs = config.extraArgs
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0);

  return [...agent.args, ...flagArgs, ...extraArgs];
}
