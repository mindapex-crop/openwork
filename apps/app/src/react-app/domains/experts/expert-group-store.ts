import { create } from "zustand";

import type { ExpertGroup, ExpertGroupInput, ExpertGroupStore } from "./expert-group-types";

/**
 * 专家组 store：前端 localStorage 持久化。
 * 后端由他人实现，联调前数据仅落本地。
 */

const STORAGE_KEY = "openwork.expert-groups";

function generateId(): string {
  return `eg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadFromStorage(): ExpertGroup[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isExpertGroup) : [];
  } catch {
    return [];
  }
}

function saveToStorage(groups: ExpertGroup[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // 静默失败：localStorage 不可用时继续运行
  }
}

function isExpertGroup(value: unknown): value is ExpertGroup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExpertGroup>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.leaderId === "string" &&
    Array.isArray(candidate.memberIds) &&
    typeof candidate.strategy === "string"
  );
}

function normalizeGroup(raw: ExpertGroup): ExpertGroup {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    leaderId: raw.leaderId,
    memberIds: Array.isArray(raw.memberIds) ? raw.memberIds.filter((id): id is string => typeof id === "string") : [],
    strategy: raw.strategy,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export const useExpertGroupStore = create<ExpertGroupStore>((set, get) => ({
  groups: loadFromStorage(),

  createGroup: async (input) => {
    const now = new Date().toISOString();
    const group: ExpertGroup = {
      id: generateId(),
      name: input.name.trim(),
      description: input.description.trim(),
      leaderId: input.leaderId,
      memberIds: input.memberIds,
      strategy: input.strategy,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...get().groups, group];
    set({ groups: next });
    saveToStorage(next);
    return group.id;
  },

  updateGroup: async (id, patch) => {
    const next = get().groups.map((group) => {
      if (group.id !== id) return group;
      const updated: ExpertGroup = normalizeGroup({
        ...group,
        ...patch,
        id: group.id,
        createdAt: group.createdAt,
        updatedAt: new Date().toISOString(),
      });
      return updated;
    });
    set({ groups: next });
    saveToStorage(next);
  },

  deleteGroup: async (id) => {
    const next = get().groups.filter((group) => group.id !== id);
    set({ groups: next });
    saveToStorage(next);
  },

  listGroups: () => get().groups,

  getGroup: (id) => get().groups.find((group) => group.id === id),
}));
