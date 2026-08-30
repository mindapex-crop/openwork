import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { SyncEngine, type SyncMessage } from './sync-engine';

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

export interface CurrentUser {
  id: string;
  name: string;
}

interface CursorPosition {
  x: number;
  y: number;
}

export interface PresenceState {
  users: PresenceUser[];
  currentUser: CurrentUser | null;
  cursors: Map<string, CursorPosition>;
}

interface PresenceActions {
  addUser: (user: Omit<PresenceUser, 'lastSeen'>) => void;
  removeUser: (userId: string) => void;
  updateCursorPosition: (userId: string, position: CursorPosition) => void;
  broadcastPresence: (syncEngine: SyncEngine) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  handleSyncMessage: (message: SyncMessage, syncEngine: SyncEngine) => void;
}

const INITIAL_STATE: PresenceState = {
  users: [],
  currentUser: null,
  cursors: new Map(),
};

export const usePresenceStore = create<PresenceState & PresenceActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      addUser: (user) => {
        set((state) => {
          const existingIndex = state.users.findIndex((u) => u.id === user.id);
          const newUser: PresenceUser = {
            ...user,
            lastSeen: Date.now(),
          };

          const updatedUsers = [...state.users];
          if (existingIndex >= 0) {
            updatedUsers[existingIndex] = newUser;
          } else {
            updatedUsers.push(newUser);
          }

          return { users: updatedUsers };
        });
      },

      removeUser: (userId) => {
        set((state) => ({
          users: state.users.filter((u) => u.id !== userId),
          cursors: new Map([...state.cursors].filter(([id]) => id !== userId)),
        }));
      },

      updateCursorPosition: (userId, position) => {
        set((state) => {
          const newCursors = new Map(state.cursors);
          newCursors.set(userId, position);
          return { cursors: newCursors };
        });
      },

      broadcastPresence: (syncEngine) => {
        const state = get();
        if (state.currentUser && syncEngine.getState() === 'connected') {
          try {
            syncEngine.sendMessage({
              type: 'presence',
              users: state.users.map((u) => ({
                id: u.id,
                name: u.name,
                color: u.color,
              })),
            });
          } catch {
            // Ignore send errors during broadcast
          }
        }
      },

      setCurrentUser: (user) => {
        set({ currentUser: user });
      },

      handleSyncMessage: (message, syncEngine) => {
        switch (message.type) {
          case 'presence': {
            set((state) => {
              const updatedUsers = message.users.map((remoteUser) => {
                const existing = state.users.find((u) => u.id === remoteUser.id);
                return {
                  id: remoteUser.id,
                  name: remoteUser.name,
                  color: remoteUser.color,
                  lastSeen: existing?.lastSeen ?? Date.now(),
                };
              });
              return { users: updatedUsers };
            });
            break;
          }
          case 'cursor_update': {
            set((state) => {
              const newCursors = new Map(state.cursors);
              newCursors.set(message.userId, message.position);
              return { cursors: newCursors };
            });
            break;
          }
          case 'document_change': {
            // Document changes handled by document store
            break;
          }
        }
      },
    }),
    {
      name: 'collab-presence-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
      }),
    },
  ),
);
