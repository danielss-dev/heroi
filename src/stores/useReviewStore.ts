import { create } from "zustand";
import {
  addInlineComment as apiAdd,
  deleteInlineComment as apiDelete,
  listInlineComments,
  markCommentResolved as apiResolve,
  shipInlineComments as apiShip,
  updateInlineComment as apiUpdate,
  type DeliveryMode,
  type InlineCommentDraftInput,
} from "../lib/tauri";
import type { InlineComment } from "../types";

interface ReviewStoreState {
  /** Comments keyed by conversationId. */
  byConversation: Record<string, InlineComment[]>;
  loadedConversations: Set<string>;

  load: (conversationId: string) => Promise<InlineComment[]>;
  reload: (conversationId: string) => Promise<InlineComment[]>;

  addDraft: (draft: InlineCommentDraftInput) => Promise<InlineComment>;
  editDraft: (commentId: string, body: string) => Promise<void>;
  removeDraft: (commentId: string) => Promise<void>;

  ship: (
    conversationId: string,
    deliveryMode: DeliveryMode
  ) => Promise<InlineComment[]>;
  resolve: (commentId: string) => Promise<void>;

  /** Live update from an MCP event; no backend call. */
  applyResolved: (conversationId: string, commentId: string) => void;

  /** Comments anchored to a specific (file, side, line). */
  forLine: (
    conversationId: string,
    filePath: string,
    side: "old" | "new",
    lineNumber: number
  ) => InlineComment[];

  draftCount: (conversationId: string) => number;
}

function setListForConversation(
  state: ReviewStoreState,
  conversationId: string,
  list: InlineComment[]
): Partial<ReviewStoreState> {
  return {
    byConversation: { ...state.byConversation, [conversationId]: list },
    loadedConversations: (() => {
      const next = new Set(state.loadedConversations);
      next.add(conversationId);
      return next;
    })(),
  };
}

export const useReviewStore = create<ReviewStoreState>((set, get) => ({
  byConversation: {},
  loadedConversations: new Set(),

  load: async (conversationId) => {
    const cached = get().byConversation[conversationId];
    if (cached && get().loadedConversations.has(conversationId)) {
      return cached;
    }
    const list = await listInlineComments(conversationId);
    set((s) => setListForConversation(s, conversationId, list));
    return list;
  },

  reload: async (conversationId) => {
    const list = await listInlineComments(conversationId);
    set((s) => setListForConversation(s, conversationId, list));
    return list;
  },

  addDraft: async (draft) => {
    const comment = await apiAdd(draft);
    set((s) => {
      const existing = s.byConversation[draft.conversationId] ?? [];
      return setListForConversation(s, draft.conversationId, [
        ...existing,
        comment,
      ]);
    });
    return comment;
  },

  editDraft: async (commentId, body) => {
    const updated = await apiUpdate(commentId, body);
    set((s) => {
      const existing = s.byConversation[updated.conversationId] ?? [];
      const next = existing.map((c) => (c.id === updated.id ? updated : c));
      return setListForConversation(s, updated.conversationId, next);
    });
  },

  removeDraft: async (commentId) => {
    const conversationId = (() => {
      for (const [cid, list] of Object.entries(get().byConversation)) {
        if (list.some((c) => c.id === commentId)) return cid;
      }
      return null;
    })();
    await apiDelete(commentId);
    if (!conversationId) return;
    set((s) => {
      const existing = s.byConversation[conversationId] ?? [];
      const next = existing.filter((c) => c.id !== commentId);
      return setListForConversation(s, conversationId, next);
    });
  },

  ship: async (conversationId, deliveryMode) => {
    const shipped = await apiShip(conversationId, deliveryMode);
    set((s) => {
      const existing = s.byConversation[conversationId] ?? [];
      const updatedIds = new Set(shipped.map((c) => c.id));
      const next = existing.map((c) =>
        updatedIds.has(c.id) ? shipped.find((x) => x.id === c.id)! : c
      );
      return setListForConversation(s, conversationId, next);
    });
    return shipped;
  },

  resolve: async (commentId) => {
    const updated = await apiResolve(commentId);
    set((s) => {
      const existing = s.byConversation[updated.conversationId] ?? [];
      const next = existing.map((c) => (c.id === updated.id ? updated : c));
      return setListForConversation(s, updated.conversationId, next);
    });
  },

  applyResolved: (conversationId, commentId) => {
    set((s) => {
      const existing = s.byConversation[conversationId];
      if (!existing) return {};
      const now = new Date().toISOString();
      const next = existing.map((c) =>
        c.id === commentId
          ? { ...c, status: "resolved" as const, resolvedAt: now }
          : c
      );
      return setListForConversation(s, conversationId, next);
    });
  },

  forLine: (conversationId, filePath, side, lineNumber) => {
    const list = get().byConversation[conversationId] ?? [];
    return list.filter(
      (c) =>
        c.filePath === filePath &&
        c.side === side &&
        c.lineNumber === lineNumber
    );
  },

  draftCount: (conversationId) => {
    const list = get().byConversation[conversationId] ?? [];
    return list.filter((c) => c.status === "draft").length;
  },
}));
