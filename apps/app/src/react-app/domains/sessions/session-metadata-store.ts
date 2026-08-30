/**
 * Zustand store for enhanced session metadata (status, pinning, archiving,
 * workspace assignment, share links). Persisted to localStorage.
 *
 * Complements the existing session-management-store (which handles pin/group
 * primitives via server sync) with locally-owned task-management fields.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SESSION_STATUSES, type SessionMetadata, type SessionStatus } from "./session-types";

type SessionMetadataState = {
  metadataById: Record<string, SessionMetadata>;
};

type SessionMetadataActions = {
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
  togglePin: (sessionId: string) => void;
  toggleArchive: (sessionId: string) => void;
  saveToWorkspace: (sessionId: string, workspaceId: string) => void;
  generateShareLink: (sessionId: string) => string;
  getSessionMetadata: (sessionId: string) => SessionMetadata | undefined;
  listByStatus: (status: SessionStatus) => SessionMetadata[];
  listPinned: () => SessionMetadata[];
  listArchived: () => SessionMetadata[];
  upsertMetadata: (session: Partial<SessionMetadata> & { id: string; title: string }) => void;
  bulkSetStatus: (sessionIds: string[], status: SessionStatus) => void;
  filtered: (criteria: {
    statuses?: SessionStatus[];
    search?: string;
    showArchived?: boolean;
  }) => SessionMetadata[];
};

type SessionMetadataStore = SessionMetadataState & SessionMetadataActions;

const PROVIDER_AGENT = "default";

function buildShareLink(sessionId: string): string {
  // Simple encoding for frontend-first sharing. Backend can replace with
  // real short links later.
  const payload = JSON.stringify({ v: 1, sid: sessionId, ts: Date.now() });
  const encoded = typeof window !== "undefined"
    ? btoa(payload)
    : Buffer.from(payload).toString("base64");
  return `openwork://session/${encoded}`;
}

export const useSessionMetadataStore = create<SessionMetadataStore>()(
  persist(
    (set, get) => ({
      metadataById: {},

      setSessionStatus: (sessionId, status) =>
        set((state) => {
          const existing = state.metadataById[sessionId];
          const metadata = existing
            ? { ...existing, status, updatedAt: new Date().toISOString() }
            : {
                id: sessionId,
                title: "",
                status,
                pinned: false,
                archived: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                messageCount: 0,
                agentId: PROVIDER_AGENT,
              };
          return { metadataById: { ...state.metadataById, [sessionId]: metadata } };
        }),

      togglePin: (sessionId) =>
        set((state) => {
          const existing = state.metadataById[sessionId];
          if (!existing) return state;
          return {
            metadataById: {
              ...state.metadataById,
              [sessionId]: {
                ...existing,
                pinned: !existing.pinned,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      toggleArchive: (sessionId) =>
        set((state) => {
          const existing = state.metadataById[sessionId];
          if (!existing) return state;
          const archived = !existing.archived;
          return {
            metadataById: {
              ...state.metadataById,
              [sessionId]: {
                ...existing,
                archived,
                status: archived ? "archived" : "pending",
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      saveToWorkspace: (sessionId, workspaceId) =>
        set((state) => {
          const existing = state.metadataById[sessionId];
          if (!existing) return state;
          return {
            metadataById: {
              ...state.metadataById,
              [sessionId]: {
                ...existing,
                workspaceId,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      generateShareLink: (sessionId) => {
        const link = buildShareLink(sessionId);
        set((state) => {
          const existing = state.metadataById[sessionId];
          if (!existing) return state;
          return {
            metadataById: {
              ...state.metadataById,
              [sessionId]: {
                ...existing,
                shareLink: link,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
        return link;
      },

      getSessionMetadata: (sessionId) => get().metadataById[sessionId],

      listByStatus: (status) =>
        Object.values(get().metadataById).filter((s) => s.status === status),

      listPinned: () =>
        Object.values(get().metadataById)
          .filter((s) => s.pinned)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

      listArchived: () =>
        Object.values(get().metadataById)
          .filter((s) => s.archived)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

      upsertMetadata: (session) =>
        set((state) => {
          const existing = state.metadataById[session.id];
          const now = new Date().toISOString();
          const merged: SessionMetadata = existing
            ? { ...existing, ...session, updatedAt: now }
            : {
                id: session.id,
                title: session.title,
                status: session.status ?? "pending",
                pinned: session.pinned ?? false,
                archived: session.archived ?? false,
                workspaceId: session.workspaceId,
                shareLink: session.shareLink,
                createdAt: session.createdAt ?? now,
                updatedAt: now,
                lastMessageAt: session.lastMessageAt,
                messageCount: session.messageCount ?? 0,
                model: session.model,
                agentId: session.agentId ?? PROVIDER_AGENT,
              };
          return { metadataById: { ...state.metadataById, [session.id]: merged } };
        }),

      bulkSetStatus: (sessionIds, status) =>
        set((state) => {
          const next = { ...state.metadataById };
          const now = new Date().toISOString();
          for (const id of sessionIds) {
            const existing = next[id];
            if (!existing) continue;
            next[id] = { ...existing, status, updatedAt: now };
          }
          return { metadataById: next };
        }),

      filtered: (criteria) => {
        const { statuses, search, showArchived } = criteria;
        const statusSet = statuses && statuses.length > 0 ? new Set(statuses) : null;
        const query = search?.trim().toLowerCase() ?? "";
        return Object.values(get().metadataById).filter((s) => {
          if (!showArchived && s.archived) return false;
          if (statusSet && !statusSet.has(s.status)) return false;
          if (query && !s.title.toLowerCase().includes(query)) return false;
          return true;
        });
      },
    }),
    {
      name: "openwork.react.sessionMetadata",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function useSessionMetadata(sessionId: string): SessionMetadata | undefined {
  return useSessionMetadataStore((s) => s.metadataById[sessionId]);
}

export function useAllSessionMetadata(): SessionMetadata[] {
  return useSessionMetadataStore((s) => Object.values(s.metadataById));
}

export function isSessionStatus(value: unknown): value is SessionStatus {
  return typeof value === "string" && (SESSION_STATUSES as string[]).includes(value);
}
