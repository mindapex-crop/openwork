/**
 * experts 路由测试 - 专家 CRUD API 契约
 *
 * GET    /experts      → { experts: ExpertDefinition[] }
 * POST   /experts      → 201 ExpertDefinition
 * GET    /experts/:id  → ExpertDefinition
 * PUT    /experts/:id  → ExpertDefinition
 * DELETE /experts/:id  → { success: true }
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApprovalService } from "../approvals.js";
import type { ReloadEventStore } from "../events.js";
import type { TokenService } from "../tokens.js";
import type { ServerConfig } from "../types.js";
import { matchRoute, type RequestContext, type Route } from "./registry.js";
import { registerExpertRoutes } from "./experts.js";

let expertsDir: string;

beforeEach(async () => {
  expertsDir = await mkdtemp(join(tmpdir(), "experts-routes-"));
});

afterEach(async () => {
  await rm(expertsDir, { recursive: true, force: true });
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

function buildRoutes(): Route[] {
  const routes: Route[] = [];
  registerExpertRoutes({ routes, jsonResponse, readJsonBody, expertsDir });
  return routes;
}

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

async function callRoute(routes: Route[], method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const route = matchRoute(routes, method, path);
  if (!route) throw new Error(`${method} ${path} not matched`);
  const request = new Request(`http://localhost${path}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } }
      : {}),
  });
  const response = await route.handler(makeCtx(request, route.params));
  return { status: response.status, body: await response.json() };
}

const samplePayload = {
  name: "前端专家",
  description: "React/Next.js 专家",
  systemPrompt: "你是资深前端工程师。",
  methodology: "组件驱动开发",
  skills: ["react", "css"],
  model: "anthropic/claude-sonnet-4",
  avatar: "🎨",
  agentId: "opencode",
  role: "specialist",
};

describe("专家 CRUD API", () => {
  test("GET /experts 空列表返回 { experts: [] }", async () => {
    const routes = buildRoutes();
    const { status, body } = await callRoute(routes, "GET", "/experts");
    expect(status).toBe(200);
    const result = body as { experts: unknown[] };
    expect(Array.isArray(result.experts)).toBe(true);
    expect(result.experts.length).toBe(0);
  });

  test("POST /experts 创建专家返回 201 + 完整字段", async () => {
    const routes = buildRoutes();
    const { status, body } = await callRoute(routes, "POST", "/experts", samplePayload);
    expect(status).toBe(201);
    const expert = body as Record<string, unknown>;
    expect(expert.id).toBe("前端专家");
    expect(expert.name).toBe("前端专家");
    expect(expert.systemPrompt).toContain("前端");
    expect(expert.methodology).toBe("组件驱动开发");
    expect(expert.skills).toEqual(["react", "css"]);
    expect(expert.model).toBe("anthropic/claude-sonnet-4");
    expect(expert.avatar).toBe("🎨");
    expect(expert.agentId).toBe("opencode");
    expect(expert.role).toBe("specialist");
    expect(typeof expert.createdAt).toBe("string");
  });

  test("POST /experts 缺少 name 或 systemPrompt 返回 400", async () => {
    const routes = buildRoutes();
    const { status } = await callRoute(routes, "POST", "/experts", { name: "无提示词" });
    expect(status).toBe(400);
    const { status: s2 } = await callRoute(routes, "POST", "/experts", { systemPrompt: "无名称" });
    expect(s2).toBe(400);
  });

  test("GET /experts 创建后可列出", async () => {
    const routes = buildRoutes();
    await callRoute(routes, "POST", "/experts", samplePayload);
    const { body } = await callRoute(routes, "GET", "/experts");
    const result = body as { experts: Array<{ name: string }> };
    expect(result.experts.some((e) => e.name === "前端专家")).toBe(true);
  });

  test("GET /experts/:id 返回单个专家", async () => {
    const routes = buildRoutes();
    const created = (await callRoute(routes, "POST", "/experts", samplePayload)).body as { id: string };
    const { status, body } = await callRoute(routes, "GET", `/experts/${created.id}`);
    expect(status).toBe(200);
    expect((body as { id: string }).id).toBe(created.id);
  });

  test("GET /experts/:id 不存在的专家返回 404", async () => {
    const routes = buildRoutes();
    const { status, body } = await callRoute(routes, "GET", "/experts/missing");
    expect(status).toBe(404);
    expect((body as { error: string }).error).toBe("not_found");
  });

  test("PUT /experts/:id 部分更新", async () => {
    const routes = buildRoutes();
    const created = (await callRoute(routes, "POST", "/experts", samplePayload)).body as { id: string };
    const { status, body } = await callRoute(routes, "PUT", `/experts/${created.id}`, {
      methodology: "测试驱动开发",
      skills: ["react", "testing"],
    });
    expect(status).toBe(200);
    const updated = body as { methodology: string; skills: string[]; name: string };
    expect(updated.methodology).toBe("测试驱动开发");
    expect(updated.skills).toEqual(["react", "testing"]);
    expect(updated.name).toBe("前端专家"); // 未更新字段保留
  });

  test("PUT /experts/:id 不存在的专家返回 404", async () => {
    const routes = buildRoutes();
    const { status } = await callRoute(routes, "PUT", "/experts/missing", { name: "x" });
    expect(status).toBe(404);
  });

  test("DELETE /experts/:id 删除后 GET 404", async () => {
    const routes = buildRoutes();
    const created = (await callRoute(routes, "POST", "/experts", samplePayload)).body as { id: string };
    const { status, body } = await callRoute(routes, "DELETE", `/experts/${created.id}`);
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
    const { status: getStatus } = await callRoute(routes, "GET", `/experts/${created.id}`);
    expect(getStatus).toBe(404);
  });

  test("DELETE /experts/:id 不存在的专家返回 404", async () => {
    const routes = buildRoutes();
    const { status } = await callRoute(routes, "DELETE", "/experts/missing");
    expect(status).toBe(404);
  });

  test("POST /experts body 无效返回 400", async () => {
    const routes = buildRoutes();
    const { status } = await callRoute(routes, "POST", "/experts", "bad");
    expect(status).toBe(400);
  });

  test("专家列表可跨请求持久（同一 store 目录）", async () => {
    // 第一个路由实例创建
    const routesA = buildRoutes();
    await callRoute(routesA, "POST", "/experts", samplePayload);
    // 第二个路由实例（模拟重启）仍能读到
    const routesB = buildRoutes();
    const { body } = await callRoute(routesB, "GET", "/experts");
    const result = body as { experts: Array<{ name: string }> };
    expect(result.experts.some((e) => e.name === "前端专家")).toBe(true);
  });
});
