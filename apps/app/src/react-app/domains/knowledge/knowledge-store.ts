import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { KnowledgeItem, KnowledgeSourceType } from "./knowledge-types";

export const PERSISTED_KNOWLEDGE_KEY = "openwork:knowledge:v1";

function now(): string {
  return new Date().toISOString();
}

export type KnowledgeStore = {
  items: KnowledgeItem[];
  createKnowledge: (title: string, description: string, content: string, sourceType: KnowledgeSourceType) => string;
  updateKnowledge: (knowledgeId: string, patch: Partial<Pick<KnowledgeItem, "title" | "description" | "content" | "sourceType">>) => void;
  deleteKnowledge: (knowledgeId: string) => void;
};

export const useKnowledgeStore = create<KnowledgeStore>()(
  persist(
    (set) => ({
      items: [],

      createKnowledge: (title, description, content, sourceType) => {
        const id = crypto.randomUUID();
        const timestamp = now();
        const item: KnowledgeItem = {
          id,
          title: title.trim(),
          description: description.trim(),
          content: content.trim(),
          sourceType,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => ({ items: [...state.items, item] }));
        return id;
      },

      updateKnowledge: (knowledgeId, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id !== knowledgeId
              ? item
              : { ...item, ...patch, updatedAt: now() },
          ),
        })),

      deleteKnowledge: (knowledgeId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== knowledgeId),
        })),
    }),
    {
      name: PERSISTED_KNOWLEDGE_KEY,
      storage: createJSONStorage(() => globalThis.localStorage),
    },
  ),
);
