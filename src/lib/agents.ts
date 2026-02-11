import type { AgentDef } from "../types";

// Fallback agent definitions in case backend is not available
export const DEFAULT_AGENTS: AgentDef[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    args: [],
    description: "Anthropic Claude Code CLI agent",
  },
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    args: [],
    description: "OpenAI Codex CLI agent",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    args: [],
    description: "Google Gemini CLI agent",
  },
  {
    id: "aider",
    name: "Aider",
    command: "aider",
    args: [],
    description: "Aider AI pair programming tool",
  },
  {
    id: "shell",
    name: "Shell",
    command: navigator.platform.includes("Win") ? "powershell.exe" : "bash",
    args: [],
    description: "Plain terminal shell",
  },
];

export function getAgentById(
  agents: AgentDef[],
  id: string
): AgentDef | undefined {
  return agents.find((a) => a.id === id);
}
