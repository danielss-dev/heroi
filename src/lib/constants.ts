import type { Settings } from "../types";

export const GIT_POLL_INTERVAL = 3000;

export const IDE_OPTIONS = [
  { id: "vscode" as const, name: "VS Code", icon: "Code2" },
  { id: "cursor" as const, name: "Cursor", icon: "MousePointer" },
  { id: "zed" as const, name: "Zed", icon: "Zap" },
];

export const DEFAULT_TERMINAL_COLS = 80;
export const DEFAULT_TERMINAL_ROWS = 24;

export const DEFAULT_SETTINGS: Settings = {
  defaultAgentId: "shell",
  gitPollInterval: 3000,
  defaultIde: "vscode",
  agentArgs: {},
};

export interface FlagDef {
  flag: string;
  label: string;
  description: string;
}

export const AGENT_KNOWN_FLAGS: Record<string, FlagDef[]> = {
  claude: [
    {
      flag: "--dangerously-skip-permissions",
      label: "Skip Permissions",
      description: "Skip permission prompts (use with caution)",
    },
    {
      flag: "--verbose",
      label: "Verbose",
      description: "Enable verbose output",
    },
  ],
  codex: [
    {
      flag: "--full-auto",
      label: "Full Auto",
      description: "Run in full auto mode without confirmations",
    },
    {
      flag: "--quiet",
      label: "Quiet",
      description: "Suppress non-essential output",
    },
  ],
  aider: [
    {
      flag: "--yes-always",
      label: "Yes Always",
      description: "Automatically confirm all prompts",
    },
    {
      flag: "--no-auto-commits",
      label: "No Auto Commits",
      description: "Disable automatic git commits",
    },
  ],
  gemini: [],
  shell: [],
};
