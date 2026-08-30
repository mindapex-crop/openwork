/**
 * 团队持久化测试 - TeamStore(sqlite) + teams 路由重启不丢数据
 *
 * 验证：
 * - TeamStore set/get/list/delete 基础 CRUD
 * - 关闭连接后重新 open（模拟服务重启）数据不丢失
 * - teams 路由创建后，新路由实例（同一 db 路径）仍能读到
 * - 现有 API 形状不变（{ teams } / { team }）
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApprovalService } from "../approvals.js";
import type { ReloadEventStore } from "../events.js";
import type { TokenService } from "../tokens.js";
import type { ServerConfig } from "../types.js";
import { TeamStore, type StoredTeam } from "./team-store.js";
import { matchRoute, type RequestContext, type Route } from "./registry.js";
import { registerTeamRoutes } from "./teams.js";

let dir: string;
let dbPath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "team-persist-"));
  dbPath = join(dir, "teams.sqlite");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function sampleTeam(): StoredTeam {
  return {
    id: "team_abc",
    name: "持久化团队",
    strategy: "balanced",
    memberSpecs: [{ agentId: "opencode", role: "primary" }],
    harnessId: "local-default",
    createdAt: 123,
    updatedAt: 123,
    status: "idle",
  };
}

describe("TeamStore 持久化", () => {
  test("set 后同实例 get/list 可读", async () => {
    const store = await TeamStore.open(dbPath);
    const team = sampleTeam();
    store.set(team);
    expect(store.get("team_abc")?.name).toBe("持久化团队");
    expect(store.list().some((t) => t.id === "team_abc")).toBe(true);
    store.close();
  });

  test("关闭后重新 open（模拟重启）数据仍在", async () => {
    // 第一次 open + 写入
    const first = await TeamStore.open(dbPath);
    first.set({ ...sampleTeam(), id: "team_restart", name: "重启验证" });
    first.close();

    // 新连接（绕过缓存，直接 open 文件）读取
    const second = await TeamStore.open(dbPath);
    const team = second.get("team_restart");
    expect(team).not.toBeUndefined();
    expect(team!.name).toBe("重启验证");
    expect(team!.memberSpecs).toEqual([{ agentId: "opencode", role: "primary" }]);
    second.close();
  });

  test("update 覆盖同 id，delete 移除", async () => {
    const store = await TeamStore.open(dbPath);
    store.set({ ...sampleTeam(), id: "team_upd", name: "旧名" });
    store.set({ ...sampleTeam(), id: "team_upd", name: "新名" });
    expect(store.get("team_upd")?.name).toBe("新名");

    expect(store.delete("team_upd")).toBe(true);
    expect(store.get("team_upd")).toBeUndefined();
    expect(store.delete("team_upd")).toBe(false);
    store.close();
  });

  test("lastTaskResult 复杂对象完整序列化/反序列化", async () => {
    const store = await TeamStore.open(dbPath);
    store.set({
      ...sampleTeam(),
      id: "team_task",
      status: "completed",
      lastTaskResult: {
        taskId: "task_1",
        subtasks: [{ subtaskId: "sub_1", agentId: "a", prompt: "p", status: "completed" }],
        completedAt: 456,
      },
    });
    store.close();

    const reopened = await TeamStore.open(dbPath);
    const team = reopened.get("team_task");
    expect(team!.status).toBe("completed");
    expect(team!.lastTaskResult?.taskId).toBe("task_1");
    expect(team!.lastTaskResult?.subtasks[0]?.status).toBe("completed");
    reopened.close();
  });
});

// ---- 路由级验证 ----

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readJsonBody(request: Request): Promise<unknown> {
  return request.json();
}

function buildRoutes(teamStorePath: string): Route[] {
  const routes: Route[] = [];
  registerTeamRoutes({ routes, jsonResponse, readJsonBody, teamStorePath });
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

describe("teams 路由持久化", () => {
  test("POST 创建后，新路由实例（模拟重启）GET 列表仍可见", async () => {
    const routesA = buildRoutes(dbPath);
    const created = (await callRoute(routesA, "POST", "/teams", {
      name: "路由持久化团队",
      members: [{ agentId: "opencode", role: "primary" }],
    })).body as { team: { id: string } };

    // 模拟重启：新的 routes 实例（同一 db 路径）
    const routesB = buildRoutes(dbPath);
    const { status, body } = await callRoute(routesB, "GET", `/teams/${created.team.id}`);
    expect(status).toBe(200);
    const result = body as { team: { id: string; name: string; status: string } };
    expect(result.team.id).toBe(created.team.id);
    expect(result.team.name).toBe("路由持久化团队");
    expect(result.team.status).toBe("idle");
  });

  test("DELETE 后新实例 GET 返回 404", async () => {
    const routesA = buildRoutes(dbPath);
    const created = (await callRoute(routesA, "POST", "/teams", {
      name: "待删除持久化",
      members: [{ agentId: "opencode" }],
    })).body as { team: { id: string } };

    await callRoute(routesA, "DELETE", `/teams/${created.team.id}`);

    const routesB = buildRoutes(dbPath);
    const { status } = await callRoute(routesB, "GET", `/teams/${created.team.id}`);
    expect(status).toBe(404);
  });
});
