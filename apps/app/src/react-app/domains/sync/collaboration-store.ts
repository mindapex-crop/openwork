/**
 * Zustand store for managing real-time collaboration state
 * Tracks connected users, cursor positions, and document presence
 */

import { create } from "zustand";
import { WebSocketClient, type SyncMessage } from "./websocket-client";

export interface Collaborator {
  userId: string;
  name: string;
  color: string;
  cursorPosition?: { line: number; column: number };
  lastSeen: number;
}

interface CollaborationState {
  collaborators: Map<string, Collaborator>;
  isConnected: boolean;
  client: WebSocketClient | null;
  connect: (url: string, userId: string, userName: string) => void;
  disconnect: () => void;
  updateCursorPosition: (line: number, column: number) => void;
  sendDocumentUpdate: (documentId: string, payload: unknown) => void;
}

const USER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181",
  "#AA96DA", "#FCBAD3", "#A8D8EA", "#FFD93D", "#6BCB77",
];

let colorIndex = 0;

function getNextColor(): string {
  const color = USER_COLORS[colorIndex % USER_COLORS.length];
  colorIndex++;
  return color;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  collaborators: new Map(),
  isConnected: false,
  client: null,

  connect: (url: string, userId: string, userName: string) => {
    const existingClient = get().client;
    if (existingClient) {
      existingClient.disconnect();
    }

    const client = new WebSocketClient({
      url,
      onMessage: (message) => {
        if (message.type === "presence") {
          const collaborator = message.payload as Collaborator;
          set((state) => {
            const updated = new Map(state.collaborators);
            updated.set(collaborator.userId, collaborator);
            return { collaborators: updated };
          });
        } else if (message.type === "cursor") {
          const cursorData = message.payload as { userId: string; position: { line: number; column: number } };
          set((state) => {
            const updated = new Map(state.collaborators);
            const existing = updated.get(cursorData.userId);
            if (existing) {
              updated.set(cursorData.userId, {
                ...existing,
                cursorPosition: cursorData.position,
                lastSeen: Date.now(),
              });
            }
            return { collaborators: updated };
          });
        }
      },
      onStateChange: (state) => {
        set({ isConnected: state === "connected" });
      },
    });

    set({ client });
    client.connect();

    // Send initial presence
    const myColor = getNextColor();
    client.send({
      type: "presence",
      documentId: "",
      userId,
      payload: { userId, name: userName, color: myColor, lastSeen: Date.now() },
      timestamp: Date.now(),
    });
  },

  disconnect: () => {
    const client = get().client;
    if (client) {
      client.disconnect();
      set({ client: null, isConnected: false, collaborators: new Map() });
    }
  },

  updateCursorPosition: (line: number, column: number) => {
    const client = get().client;
    const state = get();
    
    // In a real implementation, we'd track the current user's ID
    // For now, this is a placeholder showing the pattern
    if (client && state.isConnected) {
      client.send({
        type: "cursor",
        documentId: "",
        userId: "current-user",
        payload: { userId: "current-user", position: { line, column } },
        timestamp: Date.now(),
      });
    }
  },

  sendDocumentUpdate: (documentId: string, payload: unknown) => {
    const client = get().client;
    if (client && get().isConnected) {
      client.send({
        type: "update",
        documentId,
        userId: "current-user",
        payload,
        timestamp: Date.now(),
      });
    }
  },
}));
