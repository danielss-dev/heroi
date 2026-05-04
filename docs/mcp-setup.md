# heroi MCP setup (foundation)

heroi runs a small HTTP-JSON-RPC server on a free localhost port at app start. Spawned agents discover it through environment variables.

## Env vars set on every spawned agent

| Var | Example | Set by |
|---|---|---|
| `HEROI_MCP_URL` | `http://127.0.0.1:54321/rpc` | `terminal_spawn` (backend) |
| `HEROI_CONVERSATION_ID` | `1a2b3c4d-…` | `create_conversation` |
| `HEROI_PROJECT_ID` | `proj_a1b2c3d4` | `create_conversation` |

The agent must include `X-Heroi-Conversation-Id: <id>` on every request so the server can scope tool calls to the right working directory and project.

## Wire format

JSON-RPC 2.0 over a single endpoint:

```
POST /rpc
Content-Type: application/json
X-Heroi-Conversation-Id: <conversation id>

{ "jsonrpc": "2.0", "id": 1, "method": "<tool>", "params": { ... } }
```

Errors use standard JSON-RPC codes: `-32700` parse, `-32601` method not found, `-32602` invalid params, `-32603` server error.

## Tools

| Method | Params | Returns |
|---|---|---|
| `list_project_commands` | – | `ProjectCommand[]` filtered to `isAgentRunnable=true` |
| `run_project_command` | `{ command_id, vars: {name: value} }` | `{ runId, commandText }` |
| `get_conversation_diff` | – | `DiffOutput[]` (working dir vs base branch) |
| `post_status` | `{ text, level }` | `{}` (emits `heroi://mcp/event` to the frontend) |
| `list_inline_comments` | – | `InlineComment[]` (status ≠ resolved) |
| `mark_comment_resolved` | `{ comment_id }` | `{}` (emits `heroi://mcp/event`) |

`run_project_command` substitutes `${{NAME}}` placeholders in the project's stored shell template, writes the resolved line to the conversation's PTY (so output lands in the user-visible scrollback), and updates the per-conversation cache + project advisory cache.

## Smoke test

```sh
PORT="$HEROI_MCP_URL"  # e.g. http://127.0.0.1:54321/rpc
curl -s "$PORT" \
  -H "Content-Type: application/json" \
  -H "X-Heroi-Conversation-Id: $HEROI_CONVERSATION_ID" \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_conversation_diff"}'
```

## Future milestones

- **Structured MCP transport**: today, `ship_inline_comments` with `delivery_mode = "structured"` writes a JSON-fenced block to PTY stdin as a placeholder. A later milestone wires a real MCP notification (`heroi/inline_comments/incoming`) over the same endpoint.
- **Inter-agent dispatch tools** (`list_running_agents`, `dispatch_to_agent`, `wait_for_agent`).
- **Browser tools** for the embedded Chromium per-conversation.
- **Kanban tools** for kanban-mode conversations.
