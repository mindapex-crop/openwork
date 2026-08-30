/**
 * teams 路由测试 - 覆盖 /teams/run-simple 一键协作接口
 */
import { describe, expect, test, beforeAll } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApprovalService } from "../approvals.js";
import type { ReloadEventStore } from "../events.js";
import type { TokenService } from "../tokens.js";
import type { ServerConfig } from "../types.js";
import type { AgentDetectResult } from "../agent-sidecar/types.js";
import { matchRoute, type RequestContext, type Route } from "./registry.js";
import {
  registerTeamRoutes,
  type RunSimpleExecutor,
} from "./teams.js";

let teamStorePath: string;

beforeAll(async () => {
  // 团队持久化 sqlite 路径（隔离测试数据，避免写入真实配置目录）
  teamStorePath = join(await mkdtemp(join(tmpdir(), "teams-route-test-")), "teams.sqlite");
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readJsonBody(request: Request): Promise<unknown> {
  return request.json();
}

function buildRoutes(opts?: {
  detectAgents?: () => Promise<AgentDetectResult[]>;
  executePlan?: RunSimpleExecutor;
}): Route[] {
  const routes: Route[] = [];
  registerTeamRoutes({
    routes,
    jsonResponse,
    readJsonBody,
    teamStorePath,
    detectAgents: opts?.detectAgents,
    executePlan: opts?.executePlan,
  });
  return routes;
}

// 构造最小可用的 RequestContext：run-simple 处理器只读取 ctx.request，
// 其余依赖（config/approvals/reloadEvents/tokens）在本次场景中未使用，以空对象占位。
function makeCtx(request: Request, params: Record<string, string> = {}): RequestContext {
  return {
    request,
    url: new URL(request.url, "http://localhost"),
    params,
    config: {} as ServerConfig,
    approvals: {} as ApprovalService,
    reloadEvents: {} as ReloadEventStore,
    tokens: {} as TokenService,
  };
}

async function callRunSimple(
  routes: Route[],
  prompt: string,
): Promise<{ status: number; body: unknown }> {
  const route = matchRoute(routes, "POST", "/teams/run-simple");
  if (!route) throw new Error("route /teams/run-simple not found");
  const request = new Request("http://localhost/teams/run-simple", {
    method: "POST",
    body: JSON.stringify({ prompt }),
    headers: { "content-type": "application/json" },
  });
  const response = await route.handler(makeCtx(request));
  return { status: response.status, body: await response.json() };
}

describe("POST /teams/run-simple", () => {
  const availableAgents = async (): Promise<AgentDetectResult[]> => [
    { agentId: "opencode", available: true, binaryPath: "/usr/local/bin/opencode", version: "1.0", confidence: 0.95 },
    { agentId: "kimi", available: true, binaryPath: "/usr/local/bin/kimi", version: "2.0", confidence: 0.9 },
    { agentId: "claude-code", available: true, binaryPath: "/usr/local/bin/claude", version: "1.2", confidence: 0.8 },
    { agentId: "codex", available: false, error: "not found" },
  ];

  /** 注入假执行器：模拟真实执行结果，不 spawn 任何 agent */
  const fakeAllCompleted: RunSimpleExecutor = async ({ subtasks }) => ({
    status: "completed",
    subtaskResults: subtasks.map((s) => ({
      subtaskId: s.subtaskId,
      agentId: s.agentId,
      prompt: s.prompt,
      status: "completed",
      outputTail: "done",
    })),
    message: "Task completed: all subtasks succeeded.",
  });

  test("有可用 agent 时注入执行器后返回简化执行结果（teamId/taskId/strategy/status/subtaskResults/message）", async () => {
    const { status, body } = await callRunSimple(
      buildRoutes({ detectAgents: availableAgents, executePlan: fakeAllCompleted }),
      "实现一个登录功能",
    );

    expect(status).toBe(200);
    const result = body as {
      teamId: string;
      taskId: string;
      strategy: string;
      status: string;
      subtaskResults: Array<{
        subtaskId: string;
        agentId: string;
        prompt: string;
        status: string;
        outputTail?: string;
      }>;
      message: string;
    };
    expect(result.teamId).toMatch(/^team_/);
    expect(result.taskId).toMatch(/^task_/);
    expect(result.strategy).toBe("balanced");
    expect(result.status).toBe("completed");
    expect(result.message).toContain("completed");
    expect(result.subtaskResults.length).toBeGreaterThan(0);
    // balanced 策略 + 有 reviewer：至少一个实现子任务 + 一个评审子任务
    expect(result.subtaskResults.some((s) => s.prompt.includes("Implement"))).toBe(true);
    expect(result.subtaskResults.some((s) => s.prompt.includes("Review"))).toBe(true);
    for (const s of result.subtaskResults) {
      expect(s.subtaskId).toMatch(/^sub_/);
      expect(s.agentId.length).toBeGreaterThan(0);
      expect(s.status).toBe("completed");
      expect(typeof s.outputTail).toBe("string");
    }
  });

  test("任一子任务失败不会整体 500：注入执行器返回 partial，HTTP 仍为 200", async () => {
    const fakePartial: RunSimpleExecutor = async ({ subtasks }) => {
      const [first, ...rest] = subtasks;
      const results = first
        ? [
            { subtaskId: first.subtaskId, agentId: first.agentId, prompt: first.prompt, status: "failed" as const, outputTail: "boom" },
            ...rest.map((s) => ({ subtaskId: s.subtaskId, agentId: s.agentId, prompt: s.prompt, status: "completed" as const, outputTail: "ok" })),
          ]
        : [];
      return { status: "partial", subtaskResults: results, message: "Task partially completed." };
    };

    const { status, body } = await callRunSimple(
      buildRoutes({ detectAgents: availableAgents, executePlan: fakePartial }),
      "实现一个登录功能",
    );

    expect(status).toBe(200);
    const result = body as {
      status: string;
      subtaskResults: Array<{ subtaskId: string; agentId: string; prompt: string; status: string }>;
      message: string;
    };
    expect(result.status).toBe("partial");
    expect(result.subtaskResults.some((s) => s.status === "failed")).toBe(true);
    expect(result.subtaskResults.every((s) => s.status === "completed" || s.status === "failed")).toBe(true);
    expect(result.message).toContain("partial");
  });

  test("全部子任务失败返回 failed 但仍为 200（不 500）", async () => {
    const fakeAllFailed: RunSimpleExecutor = async ({ subtasks }) => ({
      status: "failed",
      subtaskResults: subtasks.map((s) => ({
        subtaskId: s.subtaskId,
        agentId: s.agentId,
        prompt: s.prompt,
        status: "failed",
        outputTail: "no agent",
      })),
      message: "Task failed: all subtasks failed.",
    });

    const { status, body } = await callRunSimple(
      buildRoutes({ detectAgents: availableAgents, executePlan: fakeAllFailed }),
      "实现一个登录功能",
    );

    expect(status).toBe(200);
    const result = body as { status: string; subtaskResults: Array<{ status: string }> };
    expect(result.status).toBe("failed");
    expect(result.subtaskResults.every((s) => s.status === "failed")).toBe(true);
  });

  test("无任何可用 agent 时返回 400 no_agent_available", async () => {
    const detectAgents = async (): Promise<AgentDetectResult[]> => [
      { agentId: "codex", available: false, error: "not found" },
      { agentId: "gemini", available: false, error: "not found" },
    ];

    const { status, body } = await callRunSimple(buildRoutes({ detectAgents }), "实现一个登录功能");

    expect(status).toBe(400);
    const result = body as { error: string; hint: string };
    expect(result.error).toBe("no_agent_available");
    expect(typeof result.hint).toBe("string");
    expect(result.hint.length).toBeGreaterThan(0);
  });

  test("缺少 prompt 时返回 400", async () => {
    const { status, body } = await callRunSimple(buildRoutes(), "   ");
    expect(status).toBe(400);
    const result = body as { error: string };
    expect(result.error).toBe("prompt is required");
  });
});