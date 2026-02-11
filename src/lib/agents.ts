import type { AgentDef, Settings } from "../types";

// Fallback agent definitions in case backend is not available
const isWindows = navigator.platform.includes("Win");
const shell = isWindows ? "powershell.exe" : "bash";
const shellArgs = isWindows ? ["-NoLogo"] : [];

export const DEFAULT_AGENTS: AgentDef[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: shell,
    args: [...shellArgs, "-Command", "claude"],
    description: "Anthropic Claude Code CLI agent",
  },
  {
    id: "codex",
    name: "Codex",
    command: shell,
    args: [...shellArgs, "-Command", "codex"],
    description: "OpenAI Codex CLI agent",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: shell,
    args: [...shellArgs, "-Command", "gemini"],
    description: "Google Gemini CLI agent",
  },
  {
    id: "aider",
    name: "Aider",
    command: shell,
    args: [...shellArgs, "-Command", "aider"],
    description: "Aider AI pair programming tool",
  },
  {
    id: "shell",
    name: "Shell",
    command: shell,
    args: [...shellArgs],
    description: "Plain terminal shell",
  },
];

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
