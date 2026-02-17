<div align="center">

<img src="public/heroilogo.png" alt="Heroi Logo" width="128" />

# Heroi

**Local AI Agent Orchestrator**

A desktop application for managing multiple AI coding agents across Git repositories and worktrees.

Built with [Tauri v2](https://v2.tauri.app/) · [React 19](https://react.dev/) · [Rust](https://www.rust-lang.org/)

</div>

---

## Overview

Heroi is a lightweight desktop tool that brings together your Git repositories, worktrees, and AI coding agents into a single interface. Instead of juggling terminal windows and context-switching between projects, Heroi lets you spin up isolated worktrees, launch any supported AI agent directly inside them, and monitor Git changes in real time — all from one window.

### Key Features

- **Repository Management** — Add and organize your local Git repositories with persistent storage across sessions.
- **Git Worktree Support** — Create, list, and remove worktrees from any repo. Each worktree gets its own branch and working directory, enabling parallel development without stashing or cloning.
- **AI Agent Integration** — Launch AI coding agents (Claude Code, OpenAI Codex, Google Gemini CLI, Aider) or a plain shell directly in any worktree context.
- **Embedded Terminal** — Full PTY-backed terminal powered by xterm.js with 256-color support, web links, and auto-resize.
- **Git Status & Diff Viewer** — Real-time polling of file changes with staging/unstaging controls and an inline diff preview panel.
- **IDE Launcher** — Open any worktree in VS Code, Cursor, or Zed with a single click.
- **Configurable Settings** — Set default agent, default IDE, git poll interval, and per-agent flags/arguments.

## Screenshots

<!-- Add screenshots here -->

## Supported Agents

| Agent                                                         | Description                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Anthropic's CLI coding agent                                |
| [Codex](https://github.com/openai/codex)                      | OpenAI's CLI coding agent                                   |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli)     | Google's CLI coding agent                                   |
| [Aider](https://aider.chat/)                                  | AI pair programming tool                                    |
| Shell                                                         | Plain terminal (PowerShell on Windows, Bash on Linux/macOS) |

> Agents must be installed and available in your system `PATH` for Heroi to launch them.

## Architecture

```
heroi/
├── src/                    # React frontend
│   ├── components/
│   │   ├── git/            # Git status list, diff preview
│   │   ├── layout/         # App layout, top bar
│   │   ├── settings/       # Settings modal (general + agent params)
│   │   ├── sidebar/        # Repo list, worktree management
│   │   ├── terminal/       # xterm.js terminal, agent selector
│   │   └── ui/             # Reusable UI primitives
│   ├── hooks/              # Custom hooks (git status, repos)
│   ├── lib/                # Agent definitions, Tauri IPC, constants
│   ├── stores/             # Zustand state management
│   ├── styles/             # Global CSS + Tailwind
│   └── types/              # TypeScript type definitions
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Tauri command handlers
│       │   ├── agents.rs   # Agent listing
│       │   ├── git.rs      # Status, diff, stage/unstage
│       │   ├── ide.rs      # IDE launcher
│       │   ├── repos.rs    # Repository CRUD + persistence
│       │   ├── settings.rs # Settings persistence
│       │   └── worktrees.rs# Worktree CRUD
│       ├── models/         # Data models (agent, git, repo)
│       └── state.rs        # Shared application state
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Tech Stack

| Layer          | Technology                   |
| -------------- | ---------------------------- |
| Framework      | Tauri v2                     |
| Frontend       | React 19, TypeScript, Vite 7 |
| Styling        | Tailwind CSS v4              |
| State          | Zustand                      |
| Terminal       | xterm.js + tauri-pty         |
| Icons          | Lucide React                 |
| Backend        | Rust                         |
| Git Operations | git2 (libgit2)               |
| Persistence    | tauri-plugin-store           |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform
- Git

### Installation

```
git clone https://github.com/danielss-dev/heroi.git
cd heroi
npm install
```

### Development

```
npm run tauri dev
```

This starts the Vite dev server on `http://localhost:1420` and launches the Tauri window with hot-reload enabled.

### Build

```
npm run tauri build
```

Produces platform-specific installers in `src-tauri/target/release/bundle/`.

## Usage

1. **Add a repository** — Click the **+** button in the left sidebar and select a local Git repository folder.
2. **Browse worktrees** — Expand a repository to see its main worktree and any additional worktrees.
3. **Create a worktree** — Click the worktree creation button on a repo, provide a name, and optionally configure a custom branch name and base branch.
4. **Select a worktree** — Click on any worktree to activate it. The terminal and git panels will focus on that worktree.
5. **Choose an agent** — Use the agent dropdown in the top bar to select which AI agent (or shell) to run.
6. **Run** — Click the **Run** button to spawn the selected agent inside the worktree directory. Interact with it directly in the embedded terminal.
7. **Monitor changes** — The right panel auto-polls for Git changes. Click on files to see diffs, and use the stage/unstage controls to manage your index.
8. **Open in IDE** — Use the IDE buttons in the top bar to open the current worktree in VS Code, Cursor, or Zed.
9. **Configure** — Click the gear icon in the bottom-left to adjust default agent, default IDE, git poll interval, and per-agent flags.

## Configuration

Settings are persisted locally via Tauri's store plugin and include:

| Setting           | Description                                                               | Default |
| ----------------- | ------------------------------------------------------------------------- | ------- |
| Default Agent     | Which agent is selected by default                                        | Shell   |
| Default IDE       | Which IDE opens from the top bar                                          | VS Code |
| Git Poll Interval | How often git status is refreshed (ms)                                    | 3000    |
| Agent Flags       | Per-agent toggle flags (e.g. `--dangerously-skip-permissions` for Claude) | None    |
| Extra Arguments   | Free-form arguments appended to agent commands                            | None    |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is not yet licensed. Please contact the author for usage terms.
