import type { ApiClient } from "./client";
import type { SessionInfo, SessionMessage, WorkspaceInfo } from "../types";

/**
 * 会话 API（服务端契约 apps/server/src/routes/sessions.ts）：
 * - GET  /workspaces                    → { items, workspaces, activeId }
 * - GET  /workspace/:id/sessions        → { items: SessionInfo[] }（query: search/start/limit/roots）
 * - POST /workspace/:id/sessions        → 201 { item: SessionInfo, started: boolean }
 *                                         body: { title, prompt?, providerId?, modelId?, variant? }
 * - GET  /workspace/:id/sessions/:sid   → { item: SessionInfo }
 * - GET  /workspace/:id/sessions/:sid/messages → { items: SessionMessage[] }（query: limit）
 *
 * TODO 联调（发送消息）：服务端暂无 /workspace/:id/sessions/:sid/messages 的 POST 路由，
 * 走 opencode 代理 POST /workspace/:id/opencode/session/:sid/prompt_async，
 * body 与 opencode 一致：{ parts: [{ type: "text", text }] }。
 */

export interface CreateSessionInput {
  title: string;
  prompt?: string;
}

export const sessionsApi = {
  /** 探测工作区：优先使用传入的 preferredId，否则用 activeId，再退到第一个 item */
  async resolveWorkspaceId(client: ApiClient, preferredId?: string): Promise<string> {
    if (preferredId) return preferredId;
    const result = await client.get<{
      items: WorkspaceInfo[];
      activeId: string | null;
    }>("/workspaces");
    const id = result.activeId ?? result.items?.[0]?.id;
    if (!id) {
      throw new Error("No workspace available on the server");
    }
    return id;
  },

  async list(
    client: ApiClient,
    workspaceId: string,
    options: { search?: string; limit?: number; start?: number } = {},
  ): Promise<SessionInfo[]> {
    const result = await client.get<{ items: SessionInfo[] }>(
      `/workspace/${encodeURIComponent(workspaceId)}/sessions`,
      { query: options },
    );
    return result.items ?? [];
  },

  async create(
    client: ApiClient,
    workspaceId: string,
    input: CreateSessionInput,
  ): Promise<{ item: SessionInfo; started: boolean }> {
    return client.post<{ item: SessionInfo; started: boolean }>(
      `/workspace/${encodeURIComponent(workspaceId)}/sessions`,
      input,
    );
  },

  async get(client: ApiClient, workspaceId: string, sessionId: string): Promise<SessionInfo> {
    const result = await client.get<{ item: SessionInfo }>(
      `/workspace/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`,
    );
    return result.item;
  },

  async messages(
    client: ApiClient,
    workspaceId: string,
    sessionId: string,
    options: { limit?: number } = {},
  ): Promise<SessionMessage[]> {
    const result = await client.get<{ items: SessionMessage[] }>(
      `/workspace/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
      { query: options },
    );
    return result.items ?? [];
  },

  /**
   * 发送消息（HTTP）。
   * TODO 联调：当前实现 POST /workspace/:id/opencode/session/:sid/prompt_async 代理 opencode
   * prompt_async；返回结构为 opencode 风格，待服务端会话消息协议对齐后收紧类型。
   */
  async sendMessage(
    client: ApiClient,
    workspaceId: string,
    sessionId: string,
    text: string,
  ): Promise<unknown> {
    return client.post(
      `/workspace/${encodeURIComponent(workspaceId)}/opencode/session/${encodeURIComponent(sessionId)}/prompt_async`,
      { parts: [{ type: "text", text }] },
    );
  },
};
