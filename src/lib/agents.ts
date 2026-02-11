import type { AgentDef } from "../types";

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
