import { create } from "zustand";

import { resolveServerApiBaseUrl } from "@/react-app/shell/openwork-connection";

import type {
  Expert,
  ExpertInput,
  ExpertResponse,
  ExpertsResponse,
  ExpertsStatus,
} from "./types";

/**
 * 专家 store：契约与 server 端 /api/experts（routes/experts.ts，双前缀注册）
 * 对齐。fetch 与 CRUD 失败时进入 error 状态，由页面渲染兜底 UI（错误提示 + 重试）。
 *
 * 请求路径必须带上解析后的 server base URL：应用 origin（Vite 5178）与
 * openwork-server origin（8778）在 headless-web 模式下不同源，硬编码相对路径
 * 会拿到 SPA 的 HTML 兜底页（JSON 解析报 "Unexpected token '<'"）。
 */
export const EXPERTS_API = "/api/experts";

function normalizeExpert(data: unknown): Expert | null {
  if (!data || typeof data !== "object") return null;
  const candidate = data as Partial<Expert>;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
    return null;
  }
  return {
    id: candidate.id,
    name: candidate.name,
    description: candidate.description ?? "",
    systemPrompt: candidate.systemPrompt ?? "",
    methodology: candidate.methodology ?? "",
    skills: Array.isArray(candidate.skills) ? candidate.skills.filter((s): s is string => typeof s === "string") : [],
    model: typeof candidate.model === "string" ? candidate.model : undefined,
    avatar: typeof candidate.avatar === "string" ? candidate.avatar : undefined,
    author: typeof candidate.author === "string" ? candidate.author : undefined,
    category: typeof candidate.category === "string" ? candidate.category : undefined,
  };
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = await resolveServerApiBaseUrl();
  const url = baseUrl ? `${baseUrl}${path}` : path;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function normalizeExpertsPayload(data: unknown): Expert[] {
  const experts = (data as Partial<ExpertsResponse> | null)?.experts;
  if (!Array.isArray(experts)) return [];
  return experts.map(normalizeExpert).filter((entry): entry is Expert => entry !== null);
}

function normalizeSingleExpert(data: unknown): Expert | null {
  const wrapped = (data as Partial<ExpertResponse> | null)?.expert;
  return normalizeExpert(wrapped ?? data);
}

export type ExpertsStore = {
  experts: Expert[];
  status: ExpertsStatus;
  error: string | null;
  fetchExperts: () => Promise<void>;
  createExpert: (input: ExpertInput) => Promise<Expert | null>;
  updateExpert: (expertId: string, input: ExpertInput) => Promise<Expert | null>;
  deleteExpert: (expertId: string) => Promise<boolean>;
  clearError: () => void;
};

export const useExpertsStore = create<ExpertsStore>((set) => ({
  experts: [],
  status: "idle",
  error: null,

  fetchExperts: async () => {
    set({ status: "loading", error: null });
    try {
      const data = await apiRequest<unknown>(EXPERTS_API);
      set({ experts: normalizeExpertsPayload(data), status: "ready", error: null });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  createExpert: async (input) => {
    try {
      const data = await apiRequest<unknown>(EXPERTS_API, {
        method: "POST",
        body: JSON.stringify(input),
      });
      const created = normalizeSingleExpert(data);
      if (created) {
        set((state) => ({
          experts: [...state.experts.filter((entry) => entry.id !== created.id), created],
          status: "ready",
          error: null,
        }));
      }
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  updateExpert: async (expertId, input) => {
    try {
      const data = await apiRequest<unknown>(`${EXPERTS_API}/${expertId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      const updated = normalizeSingleExpert(data);
      if (updated) {
        set((state) => ({
          experts: state.experts.map((entry) => (entry.id === expertId ? updated : entry)),
          error: null,
        }));
      }
      return updated;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  deleteExpert: async (expertId) => {
    try {
      await apiRequest<unknown>(`${EXPERTS_API}/${expertId}`, { method: "DELETE" });
      set((state) => ({
        experts: state.experts.filter((entry) => entry.id !== expertId),
        error: null,
      }));
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

// ---------- 纯筛选逻辑（可独立测试） ----------

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** 按关键词过滤专家：命中 name / description / skills / methodology / model。 */
export function filterExperts(experts: readonly Expert[], query: string): Expert[] {
  const terms = normalize(query)
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return [...experts];
  return experts.filter((expert) => {
    const haystack = normalize(
      [
        expert.name,
        expert.description,
        expert.methodology,
        expert.model ?? "",
        ...expert.skills,
      ].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
