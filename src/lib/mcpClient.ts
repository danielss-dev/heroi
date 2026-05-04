import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useReviewStore } from "../stores/useReviewStore";
import type { McpEvent } from "../types";

const EVENT_NAME = "heroi://mcp/event";

/**
 * Subscribe to MCP server events from the Rust side and dispatch them to the
 * relevant frontend stores. Returns an unsubscribe function.
 *
 * Foundation handles two event types:
 *  - `post_status` — currently logged to the console; a sidebar status banner
 *    will be added in a later milestone.
 *  - `comment_resolved` — flips the matching inline comment to resolved in
 *    `useReviewStore` without a follow-up backend round trip.
 */
export async function subscribeMcpEvents(): Promise<UnlistenFn> {
  return listen<McpEvent>(EVENT_NAME, (e) => {
    const payload = e.payload;
    if (!payload || typeof payload !== "object") return;

    switch (payload.type) {
      case "post_status":
        // eslint-disable-next-line no-console
        console.info(
          `[heroi:mcp:status] (${payload.level}) ${payload.conversation_id}: ${payload.text}`
        );
        break;
      case "comment_resolved":
        useReviewStore
          .getState()
          .applyResolved(payload.conversation_id, payload.comment_id);
        break;
      default: {
        const _exhaustive: never = payload;
        void _exhaustive;
      }
    }
  });
}
