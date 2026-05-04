import { create } from "zustand";
import { listConversations } from "../lib/tauri";
import type { Conversation, ConversationStatus } from "../types";

interface ConversationStoreState {
  conversations: Conversation[];
  selectedConversationId: string | null;
  loaded: boolean;

  setConversations: (conversations: Conversation[]) => void;
  setSelected: (id: string | null) => void;
  upsertConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  setStatus: (id: string, status: ConversationStatus) => void;

  getForProject: (projectId: string) => Conversation[];
  getById: (id: string) => Conversation | undefined;
  /** Active (non-archived) conversations on a project's primary checkout. */
  conversationsSharingPrimary: (projectId: string) => Conversation[];

  refresh: () => Promise<void>;
}

export const useConversationStore = create<ConversationStoreState>(
  (set, get) => ({
    conversations: [],
    selectedConversationId: null,
    loaded: false,

    setConversations: (conversations) =>
      set({ conversations, loaded: true }),

    setSelected: (id) => set({ selectedConversationId: id }),

    upsertConversation: (conversation) =>
      set((s) => {
        const idx = s.conversations.findIndex((c) => c.id === conversation.id);
        const next =
          idx === -1
            ? [...s.conversations, conversation]
            : s.conversations.map((c) =>
                c.id === conversation.id ? conversation : c
              );
        return { conversations: next };
      }),

    removeConversation: (id) =>
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
        selectedConversationId:
          s.selectedConversationId === id ? null : s.selectedConversationId,
      })),

    setStatus: (id, status) =>
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, status } : c
        ),
      })),

    getForProject: (projectId) =>
      get().conversations.filter((c) => c.projectId === projectId),

    getById: (id) => get().conversations.find((c) => c.id === id),

    conversationsSharingPrimary: (projectId) =>
      get().conversations.filter(
        (c) =>
          c.projectId === projectId &&
          c.workingDir.kind === "primary" &&
          !c.archivedAt
      ),

    refresh: async () => {
      try {
        const conversations = await listConversations();
        set({ conversations, loaded: true });
      } catch (err) {
        console.error("[heroi] failed to load conversations", err);
      }
    },
  })
);
