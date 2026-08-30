import type { ApiClient } from "./client";
import type { Expert } from "../types";

/**
 * 专家 API（服务端契约 apps/server/src/routes/experts.ts）：
 * - GET /experts     → { experts: Expert[] }
 * - GET /experts/:id → Expert（404 → ApiError code "not_found"）
 */
export const expertsApi = {
  async list(client: ApiClient): Promise<Expert[]> {
    const result = await client.get<{ experts: Expert[] }>("/experts");
    return result.experts ?? [];
  },

  async get(client: ApiClient, id: string): Promise<Expert> {
    return client.get<Expert>(`/experts/${encodeURIComponent(id)}`);
  },
};
