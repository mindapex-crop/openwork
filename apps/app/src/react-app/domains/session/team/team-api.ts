/**
 * Team API 传输层：契约与 server 端 routes/teams.ts 的 `/teams*` 路由同源。
 *
 * 这些路由要求 client token，且本地 server 的 origin 与应用不一定相同
 * （headless-web 下 UI 在 Vite 端口、server 在另一端口），所以每个请求都必须
 * 带上解析后的 base URL 和 Authorization 头——相对路径只会拿到 SPA 的 HTML 兜底页。
 */

import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";

export type TeamStrategyId = "conservative" | "balanced" | "aggressive";
export type HarnessKind = "local" | "ssh" | "cloud" | "container";
export type MemberRole = "primary" | "specialist" | "reviewer" | "fallback" | "observer";

export type TeamSummary = {
  id: string;
  name: string;
  strategy: TeamStrategyId;
  memberCount: number;
  harnessId: string;
  status: "idle" | "running" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
};

/** 子任务行：与 server 端 StoredTeam.lastTaskResult.subtasks 及 run 响应的子任务同形 */
export type SubtaskRow = {
  subtaskId: string;
  agentId: string;
  prompt: string;
  status: string;
  outputTail?: string;
};

export type TaskSnapshot = {
  taskId: string;
  subtasks: SubtaskRow[];
  completedAt: number;
};

export type TeamDetail = TeamSummary & {
  memberSpecs: Array<{ agentId: string; role?: string }>;
  lastTaskResult?: TaskSnapshot;
};

export type StrategyInfo = {
  id: TeamStrategyId;
  name: string;
  description: string;
  complexity: "low" | "medium" | "high";
  costLevel: "low" | "medium" | "high";
  qualityLevel: "low" | "medium" | "high";
  maxSubtasks: number;
  enableReviewLoop: boolean;
};

export type HarnessInfo = {
  id: string;
  kind: HarnessKind;
  name: string;
  description: string;
  capabilities: {
    pty: boolean;
    acp: boolean;
    http: boolean;
    mcp: boolean;
    gpu: boolean;
    docker: boolean;
    maxConcurrentAgents: number;
  };
  rootPath?: string;
  health?: {
    status: "healthy" | "degraded" | "unreachable";
    latencyMs: number;
    lastCheckedAt: number;
    message?: string;
  };
};

/** decompose 响应里的 strategyMeta = server 端 TeamStrategyMeta（不含 maxSubtasks） */
export type StrategyMeta = {
  id: TeamStrategyId;
  name: string;
  description: string;
  complexity: "low" | "medium" | "high";
  costLevel: "low" | "medium" | "high";
  qualityLevel: "low" | "medium" | "high";
  recommendedFor: string;
};

export type DecompositionResult = {
  taskId: string;
  complexity: "low" | "medium" | "high";
  strategy: TeamStrategyId;
  strategyMeta: StrategyMeta;
  suggestedApproach: string;
  subtasks: Array<{
    subtaskId: string;
    agentId: string;
    prompt: string;
    dependencies: string[];
  }>;
};

/** POST /teams/:id/run 的真实执行结果（与 /teams/run-simple 同 shape） */
export type TeamRunResult = {
  teamId: string;
  taskId: string;
  strategy: TeamStrategyId;
  status: "completed" | "failed" | "partial";
  subtaskResults: SubtaskRow[];
  message: string;
};

export async function teamApiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const { normalizedBaseUrl, resolvedToken } = await resolveOpenworkConnection();
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (resolvedToken) headers.set("Authorization", `Bearer ${resolvedToken}`);

  const response = await fetch(normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      hint?: string;
    };
    const reason = body.error ?? body.message ?? `Request failed: ${response.status}`;
    throw new Error(body.hint ? `${reason}: ${body.hint}` : reason);
  }
  return response.json() as Promise<T>;
}
